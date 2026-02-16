import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
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

    console.log('🔍 Fetching all clients...');

    // Service role で全顧客を取得してから JavaScript で絞り込み
    const allClients = await base44.asServiceRole.entities.Client.list();
    const activeClients = allClients.filter(c => c.is_active === true);

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
        error_stack: error.stack || null
      }
    }, { status: 500 });
  }
});