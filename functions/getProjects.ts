import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { client_id } = await req.json().catch(() => ({}));

    // Service role で案件を取得（is_active=true のみ）
    let projects;
    if (client_id) {
      projects = await base44.asServiceRole.entities.Project.filter({ 
        client_id: client_id,
        is_active: true 
      });
    } else {
      projects = await base44.asServiceRole.entities.Project.filter({ is_active: true });
    }

    console.log('📋 Retrieved projects:', projects.length, client_id ? `(client: ${client_id})` : '(all)');

    return Response.json({
      success: true,
      projects: projects,
      count: projects.length,
      filter: client_id ? { client_id } : null
    });

  } catch (error) {
    console.error('getProjects error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || '案件の取得に失敗しました',
      count: 0,
      projects: []
    }, { status: 500 });
  }
});