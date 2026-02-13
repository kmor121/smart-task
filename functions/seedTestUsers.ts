import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: '認証が必要です' }, { status: 401 });
    }

    // Admin のみ実行可能
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    if (!isAdmin) {
      return Response.json({ error: 'Admin のみ実行可能です' }, { status: 403 });
    }

    // Design 部署のテストユーザー 6 人分のデータ
    const testUsers = [
      { email: 'test_design01@example.com', full_name: 'テスト_デザイン01' },
      { email: 'test_design02@example.com', full_name: 'テスト_デザイン02' },
      { email: 'test_design03@example.com', full_name: 'テスト_デザイン03' },
      { email: 'test_design04@example.com', full_name: 'テスト_デザイン04' },
      { email: 'test_design05@example.com', full_name: 'テスト_デザイン05' },
      { email: 'test_design06@example.com', full_name: 'テスト_デザイン06' }
    ];

    const results = [];

    for (const testUser of testUsers) {
      console.log(`\n🔍 Processing: ${testUser.email}`);
      
      // Check if already exists
      const existing = await base44.asServiceRole.entities.User.filter({
        email: testUser.email
      });

      let savedUser;
      if (existing.length > 0) {
        // Update if necessary
        const existingUser = existing[0];
        if (existingUser.department_code !== 'design' || existingUser.app_role !== '一般') {
          await base44.asServiceRole.entities.User.update(existingUser.id, {
            department_code: 'design',
            app_role: '一般',
            full_name: testUser.full_name
          });
          console.log(`📝 Updated: ${testUser.email}`);
        }
        savedUser = { ...existingUser, department_code: 'design', app_role: '一般', full_name: testUser.full_name };
      } else {
        // Create new
        const newUser = await base44.asServiceRole.entities.User.create({
          email: testUser.email,
          full_name: testUser.full_name,
          department_code: 'design',
          role: 'user',
          app_role: '一般'
        });
        console.log(`✅ Created: ${testUser.email}`);
        savedUser = newUser;
      }

      // Verify
      const verification = await base44.asServiceRole.entities.User.filter({
        email: testUser.email
      });

      if (verification.length > 0) {
        const verified = verification[0];
        console.log(`✓ Verified: id=${verified.id}, dept=${verified.department_code}, role=${verified.app_role}`);
        results.push({
          email: verified.email,
          full_name: verified.full_name,
          department_code: verified.department_code,
          app_role: verified.app_role,
          status: 'success'
        });
      } else {
        console.error(`✗ Verification failed: ${testUser.email}`);
        results.push({
          email: testUser.email,
          status: 'failed',
          error: 'Verification failed'
        });
      }
    }

    // Summary
    const all = await base44.asServiceRole.entities.User.list();
    const designUsers = all.filter(u => u.department_code === 'design');

    console.log(`\n📊 Summary:`);
    console.log(`  Total users: ${all.length}`);
    console.log(`  Design users: ${designUsers.length}`);
    console.log(`  Created/Updated: ${results.filter(r => r.status === 'success').length}`);

    return Response.json({
      success: true,
      results,
      summary: {
        total_users: all.length,
        design_users: designUsers.length,
        created_or_updated: results.filter(r => r.status === 'success').length
      }
    });
  } catch (error) {
    console.error('seedTestUsers error:', error);
    return Response.json(
      {
        error: error.message || 'Seed failed'
      },
      { status: 500 }
    );
  }
});