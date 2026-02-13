import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 権限チェック（Frontend と完全一致）
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    const isManager = user.role === 'manager' || user.app_role === '部長' || user.app_role === '副管理者';

    if (!isAdmin && !isManager) {
      return Response.json({ error: '部長または管理者のみアクセス可能です' }, { status: 403 });
    }

    const { date, department_code, impersonate_user_email } = await req.json();

    if (!date) {
      return Response.json({ error: '日付は必須です' }, { status: 400 });
    }

    // Effective user determination
    let effectiveUser = user;
    if (impersonate_user_email) {
      // Impersonation: admin only, and only in preview/dev
      if (!isAdmin) {
        return Response.json({ error: 'Impersonation は admin のみ可能です' }, { status: 403 });
      }
      
      const impersonated = await base44.asServiceRole.entities.User.filter({
        email: impersonate_user_email
      });
      
      if (impersonated.length === 0) {
        return Response.json({ error: `Impersonate user not found: ${impersonate_user_email}` }, { status: 404 });
      }
      
      effectiveUser = impersonated[0];
      console.log(`🎭 Impersonating: ${impersonate_user_email}`);
    }

    // Re-evaluate permissions based on effective user
    const effectiveIsAdmin = effectiveUser.role === 'admin' || effectiveUser.isAdmin === true || effectiveUser.isOwner === true;
    const effectiveIsManager = effectiveUser.role === 'manager' || effectiveUser.app_role === '部長' || effectiveUser.app_role === '副管理者';

    // 部長の場合、自部署のみに強制固定（引数を無視）
    let targetDepartment = department_code;
    if (effectiveIsManager && !effectiveIsAdmin) {
      targetDepartment = effectiveUser.department_code; // 必ず自部署
    }
    
    // 部長の場合は必ず自部署のみ（リクエストの department_code は無視）
    if (effectiveIsManager && !effectiveIsAdmin && department_code !== effectiveUser.department_code) {
      console.log(`⚠️ Manager ${effectiveUser.email} attempted to access ${department_code}, forcing to own department: ${effectiveUser.department_code}`);
      targetDepartment = effectiveUser.department_code;
    }

    console.log('🔍 Authenticated User:', {
      email: user.email,
      role: user.role,
      app_role: user.app_role,
      is_admin: isAdmin,
      is_manager: isManager,
      department_code: user.department_code
    });
    
    console.log('🔍 Effective User:', {
      email: effectiveUser.email,
      role: effectiveUser.role,
      app_role: effectiveUser.app_role,
      is_admin: effectiveIsAdmin,
      is_manager: effectiveIsManager,
      department_code: effectiveUser.department_code,
      is_impersonated: impersonate_user_email ? true : false
    });
    
    console.log('🔍 Query parameters:', {
      requested_department: department_code,
      target_department: targetDepartment
    });

    // 対象部署のユーザーを取得（Users エンティティから必ず取得）
    let allUsers = [];
    let usersFetchError = null;
    let targetUsers = [];
    
    try {
      // service role で全ユーザーを取得（RLS無視）
      allUsers = await base44.asServiceRole.entities.User.list();
      console.log('📋 All users count:', allUsers.length);
      
      // サンプルユーザー情報
      const sampleUsers = allUsers.slice(0, 3).map(u => ({
        email: u.email,
        department_code: u.department_code,
        role: u.role,
        app_role: u.app_role
      }));
      console.log('🔍 Sample users:', sampleUsers);
      
      // department_code で絞り込み（Users エンティティで確実に取得）
      targetUsers = allUsers.filter(u => {
        if (!targetDepartment) return true; // adminで全社表示
        return u.department_code === targetDepartment;
      }).map(u => ({
        ...u,
        // 表示名の正規化: full_name または email の @ より前を使用
        display_name: u.full_name || u.email?.split('@')[0] || u.email || 'Unknown'
      }));
      
      console.log('👥 Target users from Users entity:', targetUsers.length, 'for department:', targetDepartment);
    } catch (err) {
      usersFetchError = err.message || String(err);
      console.error('❌ Users fetch error:', usersFetchError);
    }

    // 各ユーザーの日報を取得
    const userDailyLogs = [];

    for (const targetUser of targetUsers) {
      console.log(`\n👤 Processing user: ${targetUser.email} (${targetUser.display_name})`);
      
      // DailyLogページと完全に同じ検索条件 (line 62): work_date + user_email
      const logsByUserEmail = await base44.asServiceRole.entities.WorkLog.filter({
        user_email: targetUser.email,
        work_date: date
      });
      
      console.log(`  📧 Logs by user_email: ${logsByUserEmail.length}`);
      
      // フォールバック: user_emailが空の古いデータ用にcreated_byで検索
      const logsByCreatedBy = await base44.asServiceRole.entities.WorkLog.filter({
        created_by: targetUser.email,
        work_date: date
      });
      
      console.log(`  👨‍💼 Logs by created_by (fallback): ${logsByCreatedBy.length}`);
      
      // 優先度: user_email > created_by
      let logs = [];
      let usedField = '';
      let usedValue = '';
      
      if (logsByUserEmail.length > 0) {
        logs = logsByUserEmail;
        usedField = 'user_email';
        usedValue = targetUser.email;
        console.log(`  ✅ Using user_email match: ${logs.length} logs`);
      } else if (logsByCreatedBy.length > 0) {
        logs = logsByCreatedBy;
        usedField = 'created_by (fallback)';
        usedValue = targetUser.email;
        console.log(`  ⚠️ Fallback to created_by: ${logs.length} logs`);
      } else {
        console.log(`  ❌ No logs found for this user`);
      }

      // DailyLogと完全に同じ提出判定ロジック (line 365)
      const isSubmitted = logs.some(l => l.status === '提出済' || l.status === '承認済');
      
      console.log(`  📊 Is submitted: ${isSubmitted}`);
      
      // 提出済みログから最新のsubmitted_atを取得
      let submittedAt = null;
      const submittedLogs = logs.filter(l => l.status === '提出済' || l.status === '承認済');
      if (submittedLogs.length > 0) {
        const withSubmittedAt = submittedLogs.filter(l => l.submitted_at);
        if (withSubmittedAt.length > 0) {
          submittedAt = withSubmittedAt.sort((a, b) => 
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          )[0].submitted_at;
        }
      }
      
      // 合計時間
      const totalMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);

      // デバッグ情報（member.emailとquery valueが一致していることを確認）
      const debugInfo = {
        member_email: targetUser.email,
        member_display_name: targetUser.display_name,
        member_department: targetUser.department_code,
        query_field_used: usedField,
        query_value_used: usedValue,
        match_confirmed: targetUser.email === usedValue,
        logs_by_user_email: logsByUserEmail.length,
        logs_by_created_by: logsByCreatedBy.length,
        total_logs_used: logs.length,
        is_submitted: isSubmitted,
        total_minutes: totalMinutes
      };

      userDailyLogs.push({
        user_id: targetUser.id,
        user_email: targetUser.email,
        user_name: targetUser.display_name, // 正規化された表示名を使用
        department_code: targetUser.department_code,
        is_submitted: isSubmitted,
        submitted_at: submittedAt,
        total_minutes: totalMinutes,
        entries: logs.map(log => ({
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
        auth_user: {
          email: user.email,
          role: user.role,
          app_role: user.app_role,
          is_admin: isAdmin,
          is_manager: isManager
        },
        effective_user: {
          email: effectiveUser.email,
          role: effectiveUser.role,
          app_role: effectiveUser.app_role,
          department_code: effectiveUser.department_code,
          is_admin: effectiveIsAdmin,
          is_manager: effectiveIsManager,
          is_impersonated: impersonate_user_email ? true : false
        },
        query_info: {
          requested_department: department_code,
          target_department: targetDepartment,
          date_field: 'work_date',
          date_value: date
        },
        result_summary: {
          users_total_found: allUsers.length,
          users_in_dept_found: targetUsers.length,
          users_returned: userDailyLogs.length,
          users_submitted: userDailyLogs.filter(u => u.is_submitted).length,
          users_unsubmitted: userDailyLogs.filter(u => !u.is_submitted).length,
          sample_users: allUsers.slice(0, 3).map(u => ({
            email: u.email,
            department_code: u.department_code,
            role: u.role,
            app_role: u.app_role
          })),
          users_fetch_error: usersFetchError,
          warning: targetUsers.length === 0 ? '⚠️ Users エンティティに該当部署の部下が登録されていません' : null
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