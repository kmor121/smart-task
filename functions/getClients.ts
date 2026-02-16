import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    // Service role で全顧客を取得（is_active=true のみ）
    const clients = await base44.asServiceRole.entities.Client.filter({ is_active: true });

    console.log('📋 Retrieved clients:', clients.length);

    return Response.json({
      success: true,
      clients: clients,
      count: clients.length
    });

  } catch (error) {
    console.error('getClients error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || '顧客の取得に失敗しました',
      count: 0,
      clients: []
    }, { status: 500 });
  }
});