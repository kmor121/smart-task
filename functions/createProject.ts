import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 営業部または管理者のみ作成可能
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    if (user.department_code !== 'sales' && !isAdmin) {
      return Response.json({ error: '営業部のみ案件を作成できます' }, { status: 403 });
    }

    const { project_date, project_title, client_id, status } = await req.json();

    if (!project_date || !project_title || !client_id) {
      return Response.json({ error: '日付、案件名、顧客IDは必須です' }, { status: 400 });
    }

    // 顧客情報を取得
    const client = await base44.asServiceRole.entities.Client.get(client_id);
    if (!client) {
      return Response.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    // 表示用nameを生成（YYYY-MM-DD　タイトル）
    const name = `${project_date}　${project_title}`;

    const projectData = {
      project_date,
      project_title,
      name,
      client_id,
      client_name: client.name,
      status: status || '仮案件',
      owner_user_id: user.id,
      owner_user_name: user.full_name,
      department_code: user.department_code || 'sales',
      is_active: true
    };

    const project = await base44.asServiceRole.entities.Project.create(projectData);

    console.log('✅ Project created successfully:', {
      id: project.id,
      name: project.name,
      client_id: project.client_id,
      client_name: project.client_name,
      status: project.status
    });

    return Response.json({ success: true, project });
  } catch (error) {
    console.error('❌ Project creation failed:', error);
    return Response.json({ 
      error: error.message || '案件の作成に失敗しました',
      details: error.toString()
    }, { status: 500 });
  }
});