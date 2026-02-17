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
    const departmentCode = effectiveUser.department_code || null;

    console.log(`[${requestId}] 📝 Saving daily log:`, {
      work_date,
      user_email: userEmail,
      department_code: departmentCode,
      rows_count: rows.length,
      is_impersonated: impersonate_user_email ? true : false
    });

    // 既存ログ取得は一旦スキップ（重複チェック無し、常に create）
    console.log(`[${requestId}] ⚠️ Skipping existing log check - will create all rows as new`);

    const savedIds = [];
    const errors = [];

    // ID 正規化関数
    const normalizeId = (id) => {
      if (!id || id === "" || id === "null" || id === "_none") return null;
      if (typeof id === "object" && id !== null) {
        return id.id ? String(id.id) : (id.value ? String(id.value) : null);
      }
      return String(id);
    };

    // service role 優先で entities にアクセス
    const client = (base44 as any).asServiceRole ?? base44;
    const entities = client.entities;

    // entities.WorkLog が存在するかチェック
    if (!entities || !entities.WorkLog) {
      console.error(`[${requestId}] ❌ entities.WorkLog is undefined`);
      console.error(`[${requestId}] Available entities:`, Object.keys(entities || {}));
      return Response.json({
        success: false,
        requestId,
        step: "entityMissing",
        error: {
          message: "entities.WorkLog が見つかりません",
          available_entities: Object.keys(entities || {})
        }
      }, { status: 500 });
    }

    // 各行を保存（create のみ）
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const step = `create_row_${i}`;
      
      try {
        if (!row.work_category_id || !row.duration_minutes) {
          console.log(`[${requestId}] [${step}] ⏭️  Skipping (missing required fields)`);
          continue;
        }

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
          work_category_id: normalizeId(row.work_category_id),
          work_category_name: row.work_category_name || '',
          is_revision: row.is_revision || false,
          duration_minutes: Number(row.duration_minutes) || 0,
          description: row.description || '',
          status: row.status || '下書き',
          submitted_at: row.submitted_at || null
        };
        
        console.log(`[${requestId}] [${step}] 💾 Creating new log:`, {
          client_id: logData.client_id,
          project_id: logData.project_id,
          work_category_id: logData.work_category_id,
          duration_minutes: logData.duration_minutes
        });

        // 常に新規作成（重複チェック無し）
        const savedLog = await entities.WorkLog.create(logData);
        savedIds.push(savedLog.id);
        console.log(`[${requestId}] [${step}] ✅ Created: ${savedLog.id}`);
      } catch (error) {
        console.error(`[${requestId}] [${step}] ❌ Failed:`, error.message);
        console.error(`[${requestId}] [${step}] Stack:`, error.stack);
        errors.push({ 
          step,
          row_index: i,
          row_data: { 
            client_id: row.client_id, 
            project_id: row.project_id,
            work_category_id: row.work_category_id,
            duration_minutes: row.duration_minutes
          }, 
          error: {
            message: error.message || String(error),
            stack: error.stack
          }
        });
      }
    }

    // 削除処理はスキップ（既存チェックをしていないため）
    console.log(`[${requestId}] ⚠️ Skipping deletion (no existing log check)`);

    // 検証用：保存後のデータを確認
    let verifySample = [];
    try {
      const recentLogs = await entities.WorkLog.list("-created_date", 5);
      verifySample = recentLogs.map(log => ({
        id: log.id,
        work_date: log.work_date,
        user_email: log.user_email,
        duration_minutes: log.duration_minutes,
        status: log.status,
        created_date: log.created_date
      }));
      console.log(`[${requestId}] 🔍 Verify sample:`, verifySample);
    } catch (error) {
      console.error(`[${requestId}] ⚠️ Failed to fetch verify sample:`, error.message);
    }

    console.log(`[${requestId}] ✅ Save complete:`, {
      created: savedIds.length,
      errors: errors.length
    });

    const response = {
      success: true,
      requestId,
      saved_count: savedIds.length,
      deleted_count: 0,
      created_ids: savedIds,
      verifySample,
      errors: errors.length > 0 ? errors : undefined,
      _debug: {
        work_date,
        user_email: userEmail,
        department_code: departmentCode,
        is_impersonated: impersonate_user_email ? true : false,
        impersonate_user_email: impersonate_user_email || null,
        note: "既存ログチェック無効化中（create のみ）"
      }
    };

    return Response.json(response);

  } catch (error) {
    const step = "top_level_error";
    console.error(`[${requestId}] [${step}] ❌ saveDailyLog error:`, error.message);
    console.error(`[${requestId}] [${step}] Error stack:`, error.stack);
    console.error(`[${requestId}] [${step}] Received payload:`, JSON.stringify(payload, null, 2));
    
    return Response.json({ 
      success: false,
      requestId,
      step,
      error: {
        message: error.message || '保存に失敗しました',
        stack: error.stack,
        type: error.constructor.name,
        details: String(error)
      },
      received_payload: payload
    }, { status: 500 });
  }
});