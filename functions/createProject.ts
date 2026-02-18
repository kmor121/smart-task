import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function strId(v) {
  if (v == null) return null;
  if (typeof v === 'object' && v !== null) {
    const inner = v.id ?? v.value ?? null;
    return strId(inner);
  }
  const s = String(v).trim();
  if (!s || s === 'null' || s === '_none' || s === 'undefined') return null;
  return s;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    if (user.department_code !== 'sales' && !isAdmin) {
      return Response.json({ error: '営業部のみ案件を作成できます' }, { status: 403 });
    }

    const body = await req.json();
    const { project_date, project_title, client_id: rawClientId, client_name: inputClientName, status } = body;

    if (!project_date || !project_title) {
      return Response.json({ error: '日付と案件名は必須です' }, { status: 400 });
    }

    const clientIdStr = strId(rawClientId);

    if (!clientIdStr && !inputClientName) {
      return Response.json({ error: '顧客IDまたは顧客名が必要です' }, { status: 400 });
    }

    // 顧客を取得 or 検索 or 作成
    let client = null;
    if (clientIdStr) {
      try {
        client = await base44.asServiceRole.entities.Client.get(clientIdStr);
        console.log('Found client by ID:', client?.id, client?.name);
      } catch (e) {
        console.warn('Client.get failed:', e.message);
      }
    }
    if (!client && inputClientName) {
      const allClients = await base44.asServiceRole.entities.Client.list();
      const arr = Array.isArray(allClients) ? allClients : [];
      console.log('All clients count:', arr.length);
      client = arr.find(c => c.name === inputClientName.trim()) || null;
      if (!client) {
        client = await base44.asServiceRole.entities.Client.create({
          name: inputClientName.trim(),
          is_active: true
        });
        console.log('New client created:', client.id, client.name);
      }
    }
    if (!client) {
      return Response.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    const name = `${project_date}　${project_title}`;
    const resolvedClientId = strId(client.id);

    // まず client_id を含まない最小データで試す
    const projectData = {
      project_date,
      project_title,
      name,
      client_name: client.name,
      status: status || '仮案件',
      is_active: true,
      department_code: user.department_code || 'sales',
      owner_user_name: user.full_name || '',
    };

    // client_id を文字列で追加
    if (resolvedClientId) {
      projectData.client_id = resolvedClientId;
    }

    console.log('Creating project with data:', JSON.stringify(projectData));

    const project = await base44.asServiceRole.entities.Project.create(projectData);

    console.log('Project created:', JSON.stringify({
      id: project.id,
      name: project.name,
      client_id: project.client_id,
      client_name: project.client_name,
    }));

    return Response.json({ success: true, project });
  } catch (error) {
    console.error('Project creation failed:', error.message);
    console.error('Error data:', JSON.stringify(error?.response?.data ?? null));
    return Response.json({
      error: error.message || '案件の作成に失敗しました',
      details: error.toString()
    }, { status: 500 });
  }
});