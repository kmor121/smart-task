import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 権限チェック
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    const isManager = user.role === 'manager' || user.app_role === '部長';

    if (!isAdmin && !isManager) {
      return Response.json({ error: '部長または管理者のみアクセス可能です' }, { status: 403 });
    }

    const { date, department_code } = await req.json();

    if (!date) {
      return Response.json({ error: '日付は必須です' }, { status: 400 });
    }

    // 部長の場合、自部署のみに制限
    let targetDepartment = department_code;
    if (isManager && !isAdmin) {
      targetDepartment = user.department_code;
    }

    console.log('🔍 Query parameters:', {
      current_user_email: user.email,
      current_user_department: user.department_code,
      requested_department: department_code,
      target_department: targetDepartment,
      is_admin: isAdmin,
      is_manager: isManager
    });

    // 対象部署のユーザーを取得（表示名を正規化）
    const allUsers = await base44.asServiceRole.entities.User.list();
    console.log('📋 All users count:', allUsers.length);
    
    const targetUsers = allUsers.filter(u => {
      if (!targetDepartment) return true; // adminで全社表示
      return u.department_code === targetDepartment;
    }).map(u => ({
      ...u,
      // 表示名の正規化: full_name または email の @ より前を使用
      display_name: u.full_name || u.email?.split('@')[0] || u.email || 'Unknown'
    }));
    
    console.log('👥 Target users:', targetUsers.length, 'users found for department:', targetDepartment);

    // デバッグ: まず日付だけでWorkLogを取得してデータ構造を確認
    const allLogsForDate = await base44.asServiceRole.entities.WorkLog.filter({
      work_date: date
    });
    
    console.log(`\n🔍 DEBUG: Total WorkLog records for date ${date}:`, allLogsForDate.length);
    
    // サンプル1件を取得してフィールドを確認
    let sampleLog = null;
    if (allLogsForDate.length > 0) {
      sampleLog = allLogsForDate[0];
      console.log('📄 Sample WorkLog fields:', {
        id: sampleLog.id,
        work_date: sampleLog.work_date,
        user_email: sampleLog.user_email,
        user_name: sampleLog.user_name,
        status: sampleLog.status,
        submitted_at: sampleLog.submitted_at,
        created_by: sampleLog.created_by,
        all_keys: Object.keys(sampleLog)
      });
    }
    
    // 各ユーザーの日報を取得
    const userDailyLogs = [];

    for (const targetUser of targetUsers) {
      console.log(`\n📝 Fetching logs for user: ${targetUser.email} (${targetUser.display_name})`);
      console.log(`  Target user ID: ${targetUser.id}`);
      
      // DailyLogページと完全に同じ検索条件: WorkLogエンティティ、work_date（文字列）、user_email
      const logs = await base44.asServiceRole.entities.WorkLog.filter({
        user_email: targetUser.email,
        work_date: date
      });
      
      console.log(`  → Found ${logs.length} WorkLog records for user_email=${targetUser.email}`);
      
      // デバッグ: user_emailだけで検索
      const logsByEmail = await base44.asServiceRole.entities.WorkLog.filter({
        user_email: targetUser.email
      });
      console.log(`  → Found ${logsByEmail.length} WorkLog records for user_email (all dates)`);
      
      // デバッグ: created_byで検索してみる
      const logsByCreatedBy = await base44.asServiceRole.entities.WorkLog.filter({
        created_by: targetUser.email,
        work_date: date
      });
      console.log(`  → Found ${logsByCreatedBy.length} WorkLog records for created_by=${targetUser.email}`);
      
      // 実際に使うログ（user_emailとcreated_byの両方を試す）
      const actualLogs = logs.length > 0 ? logs : logsByCreatedBy;
      console.log(`  → Using ${actualLogs.length} logs for this user`);
      
      if (actualLogs.length > 0) {
        console.log('  → Log statuses:', actualLogs.map(l => ({ id: l.id, status: l.status, submitted_at: l.submitted_at })));
      }

      // DailyLogと完全に同じ提出判定ロジック (pages/DailyLog line 365)
      // isSubmitted = existingLogs.some(l => l.status === "提出済" || l.status === "承認済");
      const isSubmitted = actualLogs.some(l => l.status === '提出済' || l.status === '承認済');
      
      // 提出済みログから最新のsubmitted_atを取得
      let submittedAt = null;
      const submittedLogs = actualLogs.filter(l => l.status === '提出済' || l.status === '承認済');
      if (submittedLogs.length > 0) {
        const withSubmittedAt = submittedLogs.filter(l => l.submitted_at);
        if (withSubmittedAt.length > 0) {
          submittedAt = withSubmittedAt.sort((a, b) => 
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          )[0].submitted_at;
        }
      }
      
      // 合計時間
      const totalMinutes = actualLogs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);

      console.log(`  → Is submitted: ${isSubmitted}, Total minutes: ${totalMinutes}`);

      // 強化されたデバッグ情報
      const debugInfo = {
        sample_worklog: sampleLog ? {
          id: sampleLog.id,
          work_date: sampleLog.work_date,
          user_email: sampleLog.user_email,
          created_by: sampleLog.created_by,
          status: sampleLog.status
        } : null,
        query_attempts: {
          date_field: 'work_date',
          date_value: date,
          user_field_tried: 'user_email',
          user_value: targetUser.email,
          logs_by_user_email: logs.length,
          logs_by_created_by: logsByCreatedBy.length,
          logs_by_email_all_dates: logsByEmail.length,
          logs_by_date_only: allLogsForDate.length
        },
        user_info: {
          user_id: targetUser.id,
          user_email: targetUser.email,
          user_full_name: targetUser.full_name,
          user_display_name: targetUser.display_name,
          user_department: targetUser.department_code
        },
        fetch_result: {
          total_logs_found: actualLogs.length,
          log_ids: actualLogs.map(l => l.id)
        },
        submission_check: {
          is_submitted: isSubmitted,
          logs_with_status: actualLogs.map(l => ({
            id: l.id,
            status: l.status,
            submitted_at: l.submitted_at,
            is_submitted_status: l.status === '提出済' || l.status === '承認済'
          }))
        }
      };

      userDailyLogs.push({
        user_id: targetUser.id,
        user_email: targetUser.email,
        user_name: targetUser.display_name, // 正規化された表示名を使用
        department_code: targetUser.department_code,
        is_submitted: isSubmitted,
        submitted_at: submittedAt,
        total_minutes: totalMinutes,
        entries: actualLogs.map(log => ({
          client_name: log.client_name || '',
          project_name: log.project_name || '',
          work_category_name: log.work_category_name || '',
          is_revision: log.is_revision || false,
          duration_minutes: log.duration_minutes || 0,
          description: log.description || '',
          status: log.status
        })),
        _debug: debugInfo
      });
    }
    
    console.log(`\n✅ Total users with daily logs: ${userDailyLogs.length}`);

    const response = {
      success: true, 
      date,
      department_code: targetDepartment,
      users: userDailyLogs,
      _meta: {
        current_user: {
          email: user.email,
          department_code: user.department_code,
          role: user.role,
          app_role: user.app_role
        },
        query_info: {
          requested_department: department_code,
          target_department: targetDepartment,
          is_admin: isAdmin,
          is_manager: isManager,
          date_field: 'work_date',
          date_value: date
        },
        result_summary: {
          all_users_count: allUsers.length,
          target_users_count: targetUsers.length,
          users_returned: userDailyLogs.length,
          users_submitted: userDailyLogs.filter(u => u.is_submitted).length,
          users_unsubmitted: userDailyLogs.filter(u => !u.is_submitted).length
        }
      }
    };
    
    console.log('📤 Response summary:', response._meta);
    return Response.json(response);

  } catch (error) {
    console.error('getTeamDailyLogs error:', error);
    return Response.json({ 
      error: error.message || '取得に失敗しました' 
    }, { status: 500 });
  }
});