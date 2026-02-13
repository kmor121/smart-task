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

    // 対象部署のユーザーを取得（表示名を正規化）
    const allUsers = await base44.asServiceRole.entities.User.list();
    const targetUsers = allUsers.filter(u => {
      if (!targetDepartment) return true; // adminで全社表示
      return u.department_code === targetDepartment;
    }).map(u => ({
      ...u,
      // 表示名の正規化: full_name または email の @ より前を使用
      display_name: u.full_name || u.email?.split('@')[0] || u.email || 'Unknown'
    }));

    // 各ユーザーの日報を取得
    const userDailyLogs = [];

    for (const targetUser of targetUsers) {
      // 日付範囲検索: 日付文字列の等価比較
      const logs = await base44.asServiceRole.entities.WorkLog.filter({
        user_email: targetUser.email,
        work_date: date
      });

      // DailyLogと同じ提出判定ロジック: statusが"提出済"または"承認済" または submitted_atが存在
      const hasSubmittedAt = logs.some(log => log.submitted_at);
      const hasSubmittedStatus = logs.some(log => log.status === '提出済' || log.status === '承認済');
      const isSubmitted = hasSubmittedAt || hasSubmittedStatus;
      
      // 提出済みログから最新のsubmitted_atを取得
      let submittedAt = null;
      if (isSubmitted) {
        const withSubmittedAt = logs.filter(l => l.submitted_at);
        if (withSubmittedAt.length > 0) {
          submittedAt = withSubmittedAt.sort((a, b) => 
            new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
          )[0].submitted_at;
        }
      }
      
      // 合計時間
      const totalMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);

      // デバッグ情報（一時的）
      const debugInfo = {
        user_full_name: targetUser.full_name,
        user_display_name: targetUser.display_name,
        total_logs: logs.length,
        has_submitted_at: hasSubmittedAt,
        has_submitted_status: hasSubmittedStatus,
        is_submitted: isSubmitted,
        log_details: logs.map(l => ({ 
          id: l.id, 
          status: l.status, 
          submitted_at: l.submitted_at,
          has_submitted_at: !!l.submitted_at
        }))
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

    return Response.json({ 
      success: true, 
      date,
      department_code: targetDepartment,
      users: userDailyLogs,
      _meta: {
        total_users_found: targetUsers.length,
        requested_department: department_code,
        actual_department: targetDepartment,
        is_admin: isAdmin,
        is_manager: isManager
      }
    });

  } catch (error) {
    console.error('getTeamDailyLogs error:', error);
    return Response.json({ 
      error: error.message || '取得に失敗しました' 
    }, { status: 500 });
  }
});