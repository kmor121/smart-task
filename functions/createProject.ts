import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    // 営業部のみ作成可能
    if (user.department_code !== 'sales') {
      return Response.json({ error: '営業部のみ案件を作成できます' }, { status: 403 });
    }

    const { name, client_id, status } = await req.json();

    if (!name || !client_id) {
      return Response.json({ error: '案件名と顧客IDは必須です' }, { status: 400 });
    }

    // 顧客情報を取得
    const client = await base44.asServiceRole.entities.Client.get(client_id);
    if (!client) {
      return Response.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const projectData = {
      name,
      client_id,
      client_name: client.name,
      status: status || '仮案件',
      owner_user_id: user.id,
      owner_user_name: user.full_name,
      department_code: 'sales',
      is_active: true
    };

    const project = await base44.asServiceRole.entities.Project.create(projectData);

    return Response.json({ success: true, project });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});