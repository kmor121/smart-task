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
        clients: []
      }, { status: 401 });
    }

    console.log('🔍 Fetching clients for user:', user.email);

    // ユーザー権限で Client を取得（RLS適用）
    const allClients = await base44.entities.Client.list();
    
    // is_active が false のものだけ除外（undefined は有効扱い）
    const activeClients = allClients.filter(c => c.is_active !== false);

    console.log('📋 Total clients:', allClients.length, '| Active:', activeClients.length);

    return Response.json({
      success: true,
      clients: activeClients,
      count: activeClients.length,
      _debug: {
        total_count: allClients.length,
        active_count: activeClients.length,
        sample: activeClients.length > 0 ? {
          id: activeClients[0].id,
          name: activeClients[0].name,
          is_active: activeClients[0].is_active
        } : null
      }
    });

  } catch (error) {
    console.error('❌ getClients error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || String(error) || '顧客の取得に失敗しました',
      count: 0,
      clients: [],
      _debug: {
        error_type: error.constructor?.name || 'Unknown',
        error_message: error.message || String(error),
        error_stack: error.stack || null
      }
    }, { status: 500 });
  }
});