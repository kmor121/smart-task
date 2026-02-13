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
    if (existing.length > 0) {
      // User exists - update if necessary
      user = existing[0];
      console.log(`✅ User ${user_email} already exists`);
      
      // Update if department or name is different
      if (user.department_code !== department_code || (full_name && user.full_name !== full_name)) {
        const updateData = {};
        if (user.department_code !== department_code) updateData.department_code = department_code;
        if (full_name && user.full_name !== full_name) updateData.full_name = full_name;
        
        await base44.asServiceRole.entities.User.update(user.id, updateData);
        console.log(`📝 Updated user ${user_email}:`, updateData);
      }
    } else {
      // User doesn't exist - create
      const displayName = full_name || user_email.split('@')[0];
      
      const newUser = await base44.asServiceRole.entities.User.create({
        email: user_email,
        full_name: displayName,
        department_code: department_code || "",
        role: 'user',
        app_role: '一般'
      });
      
      user = newUser;
      console.log(`✅ Created new user ${user_email} in department ${department_code || "未設定"}`);
    }

    return Response.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        department_code: user.department_code
      }
    });
  } catch (error) {
    console.error('ensureUserExists error:', error);
    return Response.json({ 
      error: error.message || 'Failed to ensure user exists' 
    }, { status: 500 });
  }
});