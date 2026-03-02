import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 営業部または管理者のみ
    const isSales = user.department_code === 'sales';
    const isAdmin = user.role === 'admin' || user.isAdmin === true;
    if (!isSales && !isAdmin) {
      return Response.json({ error: '権限がありません' }, { status: 403 });
    }

    const body = await req.json();
    const name = (body.name || '').trim();

    if (!name) {
      return Response.json({ error: '顧客名は必須です' }, { status: 400 });
    }

    console.log('顧客作成開始:', name, 'by', user.email);
    const created = await base44.asServiceRole.entities.Client.create({ name, is_active: true });
    console.log('顧客作成完了:', JSON.stringify(created));

    return Response.json({ success: true, client: created });
  } catch (error) {
    console.error('顧客作成エラー:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});