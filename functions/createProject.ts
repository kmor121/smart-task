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

    // 営業部または管理者のみ作成可能
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    if (user.department_code !== 'sales' && !isAdmin) {
      return Response.json({ error: '営業部のみ案件を作成できます' }, { status: 403 });
    }

    const { project_date, project_title, client_id: rawClientId, client_name: inputClientName, status } = await req.json();

    if (!project_date || !project_title) {
      return Response.json({ error: '日付と案件名は必須です' }, { status: 400 });
    }

    const clientIdStr = strId(rawClientId);

    if (!clientIdStr && !inputClientName) {
      return Response.json({ error: '顧客IDまたは顧客名が必要です' }, { status: 400 });
    }

    // 顧客情報を取得 or 作成（asServiceRole で RLS を回避）
    let client = null;
    if (clientIdStr) {
      try {
        client = await base44.asServiceRole.entities.Client.get(clientIdStr);
      } catch (e) {
        console.warn('Client.get failed, falling back to name search:', e.message);
      }
    }
    if (!client && inputClientName) {
      const allClients = await base44.asServiceRole.entities.Client.list();
      const arr = Array.isArray(allClients) ? allClients : (allClients?.items ?? allClients?.data ?? []);
      client = arr.find(c => c.name === inputClientName.trim()) || null;
      if (!client) {
        client = await base44.asServiceRole.entities.Client.create({
          name: inputClientName.trim(),
          is_active: true
        });
        console.log('✅ New client created:', client.id, client.name);
      }
    }
    if (!client) {
      return Response.json({ error: '顧客が見つかりません' }, { status: 404 });
    }

    console.log('Project sample:', JSON.stringify({
      id: client.id,
      name: client.name,
      client_id_type: typeof client.id
    }));

    // 表示用nameを生成（YYYY-MM-DD　タイトル）
    const name = `${project_date}　${project_title}`;

    // saveDailyLog と同様に、Relation フィールドは文字列IDをそのまま渡す
    const projectData = {
      project_date,
      project_title,
      name,
      status: status || '仮案件',
      is_active: true,
      department_code: user.department_code || 'sales',
      owner_user_id: strId(user.id),
      owner_user_name: user.full_name || '',
    };

    // client_id・owner_user_id は文字列IDで渡す（saveDailyLog 準拠）
    const resolvedClientId = strId(client.id);
    if (resolvedClientId) {
      projectData.client_id = resolvedClientId;
      projectData.client_name = client.name;
    }

    // owner_user_id は除外（エラー原因の可能性）
    delete projectData.owner_user_id;

    console.log('Creating project with data:', JSON.stringify(projectData));

    const project = await base44.asServiceRole.entities.Project.create(projectData);

    console.log('✅ Project created successfully:', JSON.stringify({
      id: project.id,
      name: project.name,
      client_id: project.client_id,
      client_name: project.client_name,
      status: project.status
    }));

    return Response.json({ success: true, project });
  } catch (error) {
    console.error('❌ Project creation failed:', error.message, error.stack);
    return Response.json({
      error: error.message || '案件の作成に失敗しました',
      details: error.toString()
    }, { status: 500 });
  }
});