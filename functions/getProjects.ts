import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  // CORS対応
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false, 
        error: '認証が必要です',
        count: 0,
        projects: []
      }, { status: 401 });
    }

    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const { client_id } = body;

    console.log('🔍 Fetching projects for user:', user.email, client_id ? `client: ${client_id}` : '(all)');

    // ユーザー権限で Project を取得（RLS適用）
    const allProjects = await base44.entities.Project.list();
    
    // is_active が false のものだけ除外（undefined は有効扱い）
    let filteredProjects = allProjects.filter(p => p.is_active !== false);

    // client_id が指定されている場合はさらに絞り込み
    if (client_id) {
      filteredProjects = filteredProjects.filter(p => p.client_id === client_id);
    }

    console.log('📋 Total projects:', allProjects.length, '| Filtered:', filteredProjects.length);

    return Response.json({
      success: true,
      projects: filteredProjects,
      count: filteredProjects.length,
      filter: client_id ? { client_id } : null,
      _debug: {
        total_count: allProjects.length,
        active_count: allProjects.filter(p => p.is_active !== false).length,
        filtered_count: filteredProjects.length,
        client_id_filter: client_id || null,
        sample: filteredProjects.length > 0 ? {
          id: filteredProjects[0].id,
          name: filteredProjects[0].name || filteredProjects[0].project_title,
          project_date: filteredProjects[0].project_date,
          client_id: filteredProjects[0].client_id,
          is_active: filteredProjects[0].is_active
        } : null
      }
    });

  } catch (error) {
    console.error('❌ getProjects error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || String(error) || '案件の取得に失敗しました',
      count: 0,
      projects: [],
      _debug: {
        error_type: error.constructor?.name || 'Unknown',
        error_message: error.message || String(error),
        error_stack: error.stack || null
      }
    }, { status: 500 });
  }
});