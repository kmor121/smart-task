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

    // 対象部署のユーザーを取得
    const allUsers = await base44.asServiceRole.entities.User.list();
    const targetUsers = allUsers.filter(u => {
      if (!targetDepartment) return true; // adminで全社表示
      return u.department_code === targetDepartment;
    });

    // 各ユーザーの日報を取得
    const userDailyLogs = [];

    for (const targetUser of targetUsers) {
      const logs = await base44.asServiceRole.entities.WorkLog.filter({
        user_email: targetUser.email,
        work_date: date
      });

      // 提出済みかチェック
      const isSubmitted = logs.some(log => log.status === '提出済' || log.status === '承認済');
      
      // 合計時間
      const totalMinutes = logs.reduce((sum, log) => sum + (log.duration_minutes || 0), 0);

      userDailyLogs.push({
        user_id: targetUser.id,
        user_email: targetUser.email,
        user_name: targetUser.full_name,
        department_code: targetUser.department_code,
        is_submitted: isSubmitted,
        total_minutes: totalMinutes,
        entries: logs.map(log => ({
          client_name: log.client_name || '',
          project_name: log.project_name || '',
          work_category_name: log.work_category_name || '',
          is_revision: log.is_revision || false,
          duration_minutes: log.duration_minutes || 0,
          description: log.description || ''
        }))
      });
    }

    return Response.json({ 
      success: true, 
      date,
      department_code: targetDepartment,
      users: userDailyLogs 
    });

  } catch (error) {
    console.error('getTeamDailyLogs error:', error);
    return Response.json({ 
      error: error.message || '取得に失敗しました' 
    }, { status: 500 });
  }
});