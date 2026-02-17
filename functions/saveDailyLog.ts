import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// リクエストID生成
const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

Deno.serve(async (req) => {
  const requestId = generateRequestId();
  let payload;
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        success: false, 
        error: '認証が必要です',
        requestId 
      }, { status: 401 });
    }

    payload = await req.json();
    console.log(`[${requestId}] 📥 Received payload:`, JSON.stringify(payload, null, 2));
    
    const { work_date, rows, impersonate_user_email } = payload;

    if (!work_date || !rows || !Array.isArray(rows)) {
      console.error(`[${requestId}] ❌ Missing required fields`);
      return Response.json({ 
        success: false, 
        error: 'work_date と rows（配列）が必要です',
        requestId,
        received_payload: payload
      }, { status: 400 });
    }
    
    console.log(`[${requestId}] ✅ Validation passed. Processing ${rows.length} rows...`);

    // Effective user determination
    let effectiveUser = user;
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;
    
    if (impersonate_user_email && isAdmin) {
      console.log(`[${requestId}] 🔍 Looking for impersonated user: ${impersonate_user_email}`);
      const allUsers = await base44.asServiceRole.entities.User.list();
      const impersonated = allUsers.filter(u => u.email === impersonate_user_email);
      
      if (impersonated.length > 0) {
        effectiveUser = impersonated[0];
        console.log(`[${requestId}] 🎭 Impersonating for save: ${impersonate_user_email}`);
      }
    }

    const userEmail = effectiveUser.email;
    const userName = effectiveUser.full_name || userEmail.split('@')[0];
    const departmentCode = effectiveUser.department_code || '';

    console.log(`[${requestId}] 📝 Saving daily log:`, {
      work_date,
      user_email: userEmail,
      department_code: departmentCode,
      rows_count: rows.length,
      is_impersonated: impersonate_user_email ? true : false
    });

    // 既存の日報を取得（list→JS filter に変更）
    console.log(`[${requestId}] 🔍 Fetching existing logs for user: ${userEmail}, date: ${work_date}...`);
    
    let existingLogs = [];
    try {
      const allLogs = await base44.asServiceRole.entities.WorkLog.list();
      console.log(`[${requestId}] 📊 Total logs fetched: ${allLogs.length}`);
      existingLogs = allLogs.filter(log => 
        log.work_date === work_date && log.user_email === userEmail
      );
      console.log(`[${requestId}] 📋 Existing logs for this date/user: ${existingLogs.length}`);
    } catch (error) {
      console.error(`[${requestId}] ❌ Failed to fetch existing logs:`, error);
      throw new Error(`既存ログの取得に失敗: ${error.message}`);
    }

    const existingIds = existingLogs.map(log => log.id);
    const savedIds = [];
    const errors = [];

    // 各行を保存
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      
      if (!row.work_category_id || !row.duration_minutes) {
        console.log(`[${requestId}] ⏭️  Skipping row ${i} (missing required fields)`);
        continue; // 必須項目がない行はスキップ
      }

      // ID フィールドを正規化（空文字列 → null）
      const normalizeId = (id) => {
        if (!id || id === "" || id === "null" || id === "_none") return null;
        return String(id);
      };

      const logData = {
        work_date,
        user_email: userEmail,
        user_name: userName,
        department_code: departmentCode,
        client_id: normalizeId(row.client_id),
        client_name: row.client_name || '',
        project_id: normalizeId(row.project_id),
        project_name: row.project_name || '',
        is_temporary_project: row.is_temporary_project || false,
        work_category_id: row.work_category_id,
        work_category_name: row.work_category_name || '',
        is_revision: row.is_revision || false,
        duration_minutes: parseInt(row.duration_minutes) || 0,
        description: row.description || '',
        status: row.status || '下書き',
        submitted_at: row.submitted_at || null
      };
      
      console.log(`[${requestId}] 💾 Saving row ${i}:`, {
        client_id: logData.client_id,
        project_id: logData.project_id,
        work_category_id: logData.work_category_id,
        duration_minutes: logData.duration_minutes
      });

      try {
        let savedLog;
        if (row.id && existingIds.includes(row.id)) {
          // 既存ログを更新
          console.log(`[${requestId}] 🔄 Updating log ${row.id}...`);
          savedLog = await base44.asServiceRole.entities.WorkLog.update(row.id, logData);
          savedIds.push(row.id);
          console.log(`[${requestId}] ✅ Updated log: ${savedLog.id}`);
        } else {
          // 新規作成
          console.log(`[${requestId}] 🆕 Creating new log...`);
          savedLog = await base44.asServiceRole.entities.WorkLog.create(logData);
          savedIds.push(savedLog.id);
          console.log(`[${requestId}] ✅ Created log: ${savedLog.id}`);
        }
      } catch (error) {
        console.error(`[${requestId}] ❌ Failed to save row ${i}:`, error);
        console.error(`[${requestId}] Error stack:`, error.stack);
        errors.push({ 
          row_index: i,
          row_data: { 
            client_id: row.client_id, 
            project_id: row.project_id,
            work_category_id: row.work_category_id,
            duration_minutes: row.duration_minutes
          }, 
          error: error.message || String(error),
          stack: error.stack 
        });
      }
    }

    // 削除された行（既存にあるが今回の保存対象にない）を削除
    const idsToDelete = existingIds.filter(id => !savedIds.includes(id));
    console.log(`[${requestId}] 🗑️  Deleting ${idsToDelete.length} logs...`);
    for (const id of idsToDelete) {
      try {
        await base44.asServiceRole.entities.WorkLog.delete(id);
        console.log(`[${requestId}] ✅ Deleted log: ${id}`);
      } catch (error) {
        console.error(`[${requestId}] ❌ Failed to delete log ${id}:`, error);
      }
    }

    console.log(`[${requestId}] ✅ Save complete:`, {
      saved: savedIds.length,
      deleted: idsToDelete.length,
      errors: errors.length
    });

    const response = {
      success: true,
      requestId,
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
    console.error(`[${requestId}] ❌ saveDailyLog error:`, error);
    console.error(`[${requestId}] Error stack:`, error.stack);
    return Response.json({ 
      success: false,
      requestId,
      error: error.message || '保存に失敗しました',
      error_stack: error.stack,
      received_payload: payload,
      _debug: {
        error_type: error.constructor.name,
        error_details: String(error)
      }
    }, { status: 500 });
  }
});