import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    const isManager = user.role === 'manager' || user.app_role === '部長' || user.app_role === '副管理者';

    if (!isAdmin && !isManager) {
      return Response.json({ error: '部長または管理者のみアクセス可能です' }, { status: 403 });
    }

    const body = await req.json();
    const { date_from, date_to, department_code, impersonate_department_code, impersonate_is_manager } = body;

    if (!date_from || !date_to) {
      return Response.json({ error: '日付範囲は必須です' }, { status: 400 });
    }

    // impersonate中の場合はフロントから送られた部署・権限情報を使う
    const effectiveDeptCode = impersonate_department_code || user.department_code;
    const effectiveIsManager = impersonate_is_manager === true ? true : isManager;

    // 部長は自部署のみに強制
    let targetDept = department_code || null;
    if (effectiveIsManager && !isAdmin) {
      targetDept = effectiveDeptCode;
    }

    // 全WorkLogを取得（日付範囲でJS側フィルタ）
    const allLogs = await base44.asServiceRole.entities.WorkLog.list('-work_date', 10000);

    const filtered = allLogs.filter(log => {
      if (!log.work_date) return false;
      if (log.work_date < date_from || log.work_date > date_to) return false;
      if (targetDept && log.department_code !== targetDept) return false;
      return true;
    });

    // 日付ごとにグループ化
    const byDate = {};
    for (const log of filtered) {
      const d = log.work_date;
      if (!byDate[d]) byDate[d] = [];
      byDate[d].push(log);
    }

    // 日付降順でソート
    const dates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

    const grouped = dates.map(date => {
      const logs = byDate[date];

      // ユーザー別にグループ化
      const byUser = {};
      for (const log of logs) {
        const email = log.user_email || log.created_by || 'unknown';
        if (!byUser[email]) {
          byUser[email] = {
            user_email: email,
            user_name: log.user_name || email.split('@')[0],
            department_code: log.department_code || '',
            logs: []
          };
        }
        byUser[email].logs.push(log);
      }

      const users = Object.values(byUser).map(u => {
        const isSubmitted = u.logs.some(l => l.status === '提出済' || l.status === '承認済');
        const totalMinutes = u.logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
        return {
          user_email: u.user_email,
          user_name: u.user_name,
          department_code: u.department_code,
          is_submitted: isSubmitted,
          total_minutes: totalMinutes,
          entries: u.logs.map(l => ({
            client_name: l.client_name || '',
            project_name: l.project_name || '',
            work_category_name: l.work_category_name || '',
            is_revision: l.is_revision || false,
            duration_minutes: l.duration_minutes || 0,
            description: l.description || '',
            status: l.status || ''
          }))
        };
      });

      const submittedCount = users.filter(u => u.is_submitted).length;
      const unsubmittedCount = users.filter(u => !u.is_submitted).length;
      const totalMinutes = users.reduce((sum, u) => sum + u.total_minutes, 0);

      return {
        date,
        users,
        submitted_count: submittedCount,
        unsubmitted_count: unsubmittedCount,
        total_minutes: totalMinutes
      };
    });

    return Response.json({
      success: true,
      date_from,
      date_to,
      department_code: targetDept,
      groups: grouped,
      is_admin: isAdmin,
      is_manager: isManager
    });

  } catch (error) {
    console.error('getTeamDailyLogs error:', error);
    return Response.json({ error: error.message || '取得に失敗しました' }, { status: 500 });
  }
});