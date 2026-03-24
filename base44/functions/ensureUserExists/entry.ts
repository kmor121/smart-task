import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_email, full_name, department_code } = await req.json();

    if (!user_email || !department_code) {
      return Response.json({ error: 'user_email and department_code are required' }, { status: 400 });
    }

    // Check if user exists
    const existing = await base44.asServiceRole.entities.User.filter({
      email: user_email
    });

    let user;
    const displayName = full_name || user_email.split('@')[0];
    
    if (existing.length > 0) {
      // User exists - update necessary fields
      user = existing[0];
      console.log(`ℹ️ User ${user_email} already exists (id: ${user.id})`);
      
      // Always ensure department_code is set
      const updateData = {};
      if (!user.department_code || user.department_code !== department_code) {
        updateData.department_code = department_code;
      }
      if (full_name && user.full_name !== full_name) {
        updateData.full_name = full_name;
      }
      
      if (Object.keys(updateData).length > 0) {
        await base44.asServiceRole.entities.User.update(user.id, updateData);
        console.log(`📝 Updated user ${user_email}:`, updateData);
        user = { ...user, ...updateData };
      }
    } else {
      // User doesn't exist - create
      const newUser = await base44.asServiceRole.entities.User.create({
        email: user_email,
        full_name: displayName,
        department_code: department_code,
        role: 'user',
        app_role: '一般'
      });
      
      user = newUser;
      console.log(`✅ Created new user ${user_email} in department ${department_code}`);
    }

    // 📋 Verify user was saved correctly
    console.log(`\n🔍 Verifying user in database...`);
    const verification = await base44.asServiceRole.entities.User.filter({
      email: user_email
    });
    
    if (verification.length === 0) {
      console.error(`❌ CRITICAL: User ${user_email} not found after create/update!`);
      return Response.json({
        error: `User ${user_email} could not be persisted to database`,
        debug: { user_email, department_code }
      }, { status: 500 });
    }
    
    const verifiedUser = verification[0];
    console.log(`✅ User verified in database:`);
    console.log(`   id: ${verifiedUser.id}`);
    console.log(`   email: ${verifiedUser.email}`);
    console.log(`   full_name: ${verifiedUser.full_name}`);
    console.log(`   department_code: ${verifiedUser.department_code}`);
    console.log(`   role: ${verifiedUser.role}`);
    console.log(`   app_role: ${verifiedUser.app_role}`);

    return Response.json({
      success: true,
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        full_name: verifiedUser.full_name,
        department_code: verifiedUser.department_code,
        role: verifiedUser.role,
        app_role: verifiedUser.app_role
      }
    });
  } catch (error) {
    console.error('ensureUserExists error:', error);
    return Response.json({ 
      error: error.message || 'Failed to ensure user exists' 
    }, { status: 500 });
  }
});