import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ success: false, error: '認証が必要です' }, { status: 401 });
    }

    const { work_date, rows, impersonate_user_email } = await req.json();

    if (!work_date || !rows || !Array.isArray(rows)) {
      return Response.json({ 
        success: false, 
        error: 'work_date と rows（配列）が必要です' 
      }, { status: 400 });
    }

    // Effective user determination
    let effectiveUser = user;
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    
    if (impersonate_user_email && isAdmin) {
      const impersonated = await base44.asServiceRole.entities.User.filter({
        email: impersonate_user_email
      });
      
      if (impersonated.length > 0) {
        effectiveUser = impersonated[0];
        console.log(`🎭 Impersonating for save: ${impersonate_user_email}`);
      }
    }

    const userEmail = effectiveUser.email;
    const userName = effectiveUser.full_name || userEmail.split('@')[0];
    const departmentCode = effectiveUser.department_code || '';

    console.log('📝 Saving daily log:', {
      work_date,
      user_email: userEmail,
      department_code: departmentCode,
      rows_count: rows.length,
      is_impersonated: impersonate_user_email ? true : false
    });

    // 既存の日報を取得
    const existingLogs = await base44.asServiceRole.entities.WorkLog.filter({
      work_date,
      user_email: userEmail
    });

    console.log('📋 Existing logs:', existingLogs.length);

    const existingIds = existingLogs.map(log => log.id);
    const savedIds = [];
    const errors = [];

    // 各行を保存
    for (const row of rows) {
      if (!row.work_category_id || !row.duration_minutes) {
        continue; // 必須項目がない行はスキップ
      }

      const logData = {
        work_date,
        user_email: userEmail,
        user_name: userName,
        department_code: departmentCode,
        client_id: row.client_id || '',
        client_name: row.client_name || '',
        project_id: row.project_id || '',
        project_name: row.project_name || '',
        is_temporary_project: row.is_temporary_project || false,
        work_category_id: row.work_category_id,
        work_category_name: row.work_category_name || '',
        is_revision: row.is_revision || false,
        duration_minutes: parseInt(row.duration_minutes) || 0,
        description: row.description || '',
        status: row.status || '下書き'
      };

      try {
        let savedLog;
        if (row.id && existingIds.includes(row.id)) {
          // 既存ログを更新
          savedLog = await base44.asServiceRole.entities.WorkLog.update(row.id, logData);
          savedIds.push(row.id);
        } else {
          // 新規作成
          savedLog = await base44.asServiceRole.entities.WorkLog.create(logData);
          savedIds.push(savedLog.id);
        }
        console.log(`✅ Saved log: ${savedLog.id}`);
      } catch (error) {
        console.error('❌ Failed to save log:', error);
        errors.push({ row, error: error.message || String(error) });
      }
    }

    // 削除された行（既存にあるが今回の保存対象にない）を削除
    const idsToDelete = existingIds.filter(id => !savedIds.includes(id));
    for (const id of idsToDelete) {
      try {
        await base44.asServiceRole.entities.WorkLog.delete(id);
        console.log(`🗑️ Deleted log: ${id}`);
      } catch (error) {
        console.error(`❌ Failed to delete log ${id}:`, error);
      }
    }

    const response = {
      success: true,
      saved_count: savedIds.length,
      deleted_count: idsToDelete.length,
      errors: errors.length > 0 ? errors : undefined,
      _debug: {
        work_date,
        user_email: userEmail,
        department_code: departmentCode,
        is_impersonated: impersonate_user_email ? true : false,
        impersonate_user_email: impersonate_user_email || null
      }
    };

    return Response.json(response);

  } catch (error) {
    console.error('saveDailyLog error:', error);
    return Response.json({ 
      success: false, 
      error: error.message || '保存に失敗しました' 
    }, { status: 500 });
  }
});