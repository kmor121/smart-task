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
    let clientId = clientIdStr;
    let clientName = inputClientName ? inputClientName.trim() : '';

    if (!clientName && clientIdStr) {
      try {
        const client = await base44.asServiceRole.entities.Client.get(clientIdStr);
        clientName = client?.name || '';
        console.log('Found client by ID:', clientIdStr, clientName);
      } catch (e) {
        console.warn('Client.get failed:', e.message);
      }
    } else if (!clientIdStr && inputClientName) {
      const allClients = await base44.asServiceRole.entities.Client.list();
      const arr = Array.isArray(allClients) ? allClients : [];
      const found = arr.find(c => c.name === inputClientName.trim());
      if (found) {
        clientId = strId(found.id);
        clientName = found.name;
        console.log('Found client by name:', clientId, clientName);
      } else {
        const newClient = await base44.asServiceRole.entities.Client.create({
          name: inputClientName.trim(),
          is_active: true
        });
        clientId = strId(newClient.id);
        clientName = newClient.name;
        console.log('Created new client:', clientId, clientName);
      }
    }

    const name = `${project_date}　${project_title}`;

    // Project エンティティのスキーマ: client_id は type:string (Relation ではない)
    // is_active も boolean フィールドとして存在する
    // 最小限のフィールドのみで作成
    const projectData = {
      project_date,
      project_title,
      name,
      client_name: clientName,
      status: status || '仮案件',
    };

    if (clientId) {
      projectData.client_id = clientId;
    }

    console.log('Creating project:', JSON.stringify(projectData));

    const project = await base44.asServiceRole.entities.Project.create(projectData);

    console.log('Project created:', JSON.stringify({
      id: project.id,
      name: project.name,
      client_id: project.client_id,
      client_name: project.client_name,
    }));

    // フロントエンド用に client_id を文字列で返す
    const returnProject = {
      ...project,
      client_id: strId(project.client_id) || clientId,
      client_name: project.client_name || clientName,
    };

    return Response.json({ success: true, project: returnProject });
  } catch (error) {
    console.error('Project creation failed:', error.message);
    console.error('Error data:', JSON.stringify(error?.response?.data ?? null));
    return Response.json({
      error: error.message || '案件の作成に失敗しました',
      details: error.toString()
    }, { status: 500 });
  }
});