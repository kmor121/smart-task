import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Admin only
    if (!user || (user.role !== 'admin' && !user.isAdmin && !user.isOwner)) {
      return Response.json({ success: false, error: '管理者のみ実行可能です' }, { status: 403 });
    }

    const { work_date, department_code } = await req.json();

    if (!work_date || !department_code) {
      return Response.json({ 
        success: false, 
        error: 'work_date と department_code が必要です' 
      }, { status: 400 });
    }

    console.log('🧪 Creating test daily logs:', { work_date, department_code });

    // 対象部署の一般ユーザーを取得
    const allUsers = await base44.asServiceRole.entities.User.list();
    const targetUsers = allUsers.filter(u => 
      u.department_code === department_code && 
      (u.app_role === '一般' || u.role === 'staff' || !u.role || u.role === 'user')
    );

    console.log('👥 Target users:', targetUsers.length);

    if (targetUsers.length === 0) {
      return Response.json({
        success: false,
        error: `部署 ${department_code} に一般ユーザーが見つかりません`
      });
    }

    // 顧客・案件・作業区分を取得
    const clients = await base44.asServiceRole.entities.Client.filter({ is_active: true });
    const projects = await base44.asServiceRole.entities.Project.filter({ is_active: true });
    const workCategories = await base44.asServiceRole.entities.WorkCategory.list();

    // 部署に応じた作業区分を選択
    const deptWorkCategories = workCategories.filter(wc => 
      !wc.department_code || wc.department_code === department_code
    );

    if (clients.length === 0 || projects.length === 0 || deptWorkCategories.length === 0) {
      return Response.json({
        success: false,
        error: 'マスタデータ（顧客・案件・作業区分）が不足しています'
      });
    }

    const createdLogs = [];
    const errors = [];

    // 各ユーザーに対して日報を作成
    for (const targetUser of targetUsers) {
      // ランダムに顧客・案件・作業区分を選択
      const randomClient = clients[Math.floor(Math.random() * clients.length)];
      const randomProject = projects[Math.floor(Math.random() * projects.length)];
      const randomWorkCategory = deptWorkCategories[Math.floor(Math.random() * deptWorkCategories.length)];

      const logData = {
        work_date,
        user_email: targetUser.email,
        user_name: targetUser.full_name || targetUser.email.split('@')[0],
        department_code: targetUser.department_code,
        client_id: randomClient.id,
        client_name: randomClient.name,
        project_id: randomProject.id,
        project_name: randomProject.name || randomProject.project_title,
        is_temporary_project: false,
        work_category_id: randomWorkCategory.id,
        work_category_name: randomWorkCategory.name,
        is_revision: false,
        duration_minutes: 30 + Math.floor(Math.random() * 210), // 30分～4時間
        description: 'テスト日報（自動作成）',
        status: '提出済',
        submitted_at: new Date().toISOString()
      };

      try {
        const savedLog = await base44.asServiceRole.entities.WorkLog.create(logData);
        createdLogs.push({
          user_email: targetUser.email,
          work_log_id: savedLog.id
        });
        console.log(`✅ Created test log for ${targetUser.email}`);
      } catch (error) {
        console.error(`❌ Failed to create log for ${targetUser.email}:`, error);
        errors.push({
          user_email: targetUser.email,
          error: error.message || String(error)
        });
      }
    }

    const response = {
      success: true,
      created_count: createdLogs.length,
      target_users_count: targetUsers.length,
      errors: errors.length > 0 ? errors : undefined,
      created_logs: createdLogs,
      _debug: {
        work_date,
        department_code,
        target_users: targetUsers.map(u => ({ email: u.email, name: u.full_name }))
      }
    };

    return Response.json(response);

  } catch (error) {
    console.error('createTestDailyLogs error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || 'テスト日報の作成に失敗しました' 
    }, { status: 500 });
  }
});