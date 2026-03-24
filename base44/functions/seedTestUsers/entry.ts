import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const testUsers = [
  { email: 'test_sales01@example.com',      full_name: 'テスト_営業_一般',   department_code: 'sales',       app_role: '一般' },
  { email: 'test_sales_mgr@example.com',    full_name: 'テスト_営業_部長',   department_code: 'sales',       app_role: '部長' },
  { email: 'test_design01@example.com',     full_name: 'テスト_制作_一般',   department_code: 'design',      app_role: '一般' },
  { email: 'test_design_mgr@example.com',   full_name: 'テスト_制作_部長',   department_code: 'design',      app_role: '部長' },
  { email: 'test_ict01@example.com',        full_name: 'テスト_ICT_一般',    department_code: 'ict',         app_role: '一般' },
  { email: 'test_ict_mgr@example.com',      full_name: 'テスト_ICT_部長',    department_code: 'ict',         app_role: '部長' },
  { email: 'test_printing01@example.com',   full_name: 'テスト_印刷_一般',   department_code: 'printing',    app_role: '一般' },
  { email: 'test_printing_mgr@example.com', full_name: 'テスト_印刷_部長',   department_code: 'printing',    app_role: '部長' },
  { email: 'test_production01@example.com', full_name: 'テスト_製本_一般',   department_code: 'production',  app_role: '一般' },
  { email: 'test_production_mgr@example.com', full_name: 'テスト_製本_部長', department_code: 'production',  app_role: '部長' },
  { email: 'test_admin01@example.com',      full_name: 'テスト_総務_一般',   department_code: 'admin',       app_role: '一般' },
  { email: 'test_admin_mgr@example.com',    full_name: 'テスト_総務_部長',   department_code: 'admin',       app_role: '部長' },
];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    if (!isAdmin) {
      return Response.json({ error: 'Admin のみ実行可能です' }, { status: 403 });
    }

    const results = [];

    for (const testUser of testUsers) {
      console.log(`\n🔍 Processing: ${testUser.email}`);

      const existing = await base44.asServiceRole.entities.User.filter({ email: testUser.email });

      if (existing.length > 0) {
        const existingUser = existing[0];
        await base44.asServiceRole.entities.User.update(existingUser.id, {
          full_name: testUser.full_name,
          department_code: testUser.department_code,
          app_role: testUser.app_role,
        });
        console.log(`📝 Updated: ${testUser.email}`);
        results.push({ ...testUser, status: 'updated' });
      } else {
        await base44.asServiceRole.entities.User.create({
          email: testUser.email,
          full_name: testUser.full_name,
          department_code: testUser.department_code,
          role: 'user',
          app_role: testUser.app_role,
        });
        console.log(`✅ Created: ${testUser.email}`);
        results.push({ ...testUser, status: 'created' });
      }
    }

    const all = await base44.asServiceRole.entities.User.list();

    return Response.json({
      success: true,
      results,
      summary: {
        total_users: all.length,
        created_or_updated: results.length,
      }
    });
  } catch (error) {
    console.error('seedTestUsers error:', error);
    return Response.json({ error: error.message || 'Seed failed' }, { status: 500 });
  }
});