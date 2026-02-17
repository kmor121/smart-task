import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isRecord(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parseJsonMaybe(v) {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (isRecord(v) && Array.isArray(v.items)) return v.items;
  if (isRecord(v) && Array.isArray(v.data)) return v.data;
  return [];
}

function normalizeDate(d) {
  if (!d) return '';
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
  return false;
}

function toNumber(v) {
  const n =
    typeof v === 'number' ? v :
    typeof v === 'string' ? Number(v) :
    NaN;
  return Number.isFinite(n) ? n : NaN;
}

function normalizeStatus(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return 'draft';
  if (s.includes('提出')) return 'submitted';
  if (s.includes('下書')) return 'draft';
  if (s === 'submitted' || s === 'draft') return s;
  return s;
}

function pickString(obj, keys) {
  if (!isRecord(obj)) return null;
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
    if (typeof v === 'number') return String(v);
  }
  return null;
}

function getErrorInfo(e) {
  if (e instanceof Error) {
    return { message: e.message, stack: e.stack ?? null };
  }
  return { message: String(e), stack: null };
}

Deno.serve(async (req) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let step = 'start';

  try {
    const base44 = createClientFromRequest(req);

    step = 'auth';
    const user = await base44.auth.me();
    if (!user) {
      return jsonResponse({ success: false, requestId, step, errorMessage: '認証が必要です' });
    }

    step = 'parseBody';
    const rawBody = await req.json();
    let body = parseJsonMaybe(rawBody);

    if (!isRecord(body)) {
      return jsonResponse({
        success: false,
        requestId,
        step,
        errorMessage: 'リクエストJSONが不正です',
        bodyType: typeof body,
        body,
      });
    }

    const work_date = normalizeDate(
      body.work_date ?? body.log_date ?? body.logDate ?? body.date
    );

    let rowsRaw = body.rows ?? body.items ?? body.entries ?? [];
    rowsRaw = parseJsonMaybe(rowsRaw);

    const rowsArr = Array.isArray(rowsRaw) ? rowsRaw : [rowsRaw];

    // ★ここが重要：rowsの各要素が string(JSON文字列) なら object に戻す
    const rows = rowsArr
      .map((r) => parseJsonMaybe(r))
      .map((r) => (typeof r === 'string' ? parseJsonMaybe(r) : r))
      .filter((r) => isRecord(r));

    const impersonate_user_email =
      typeof body.impersonate_user_email === 'string' ? body.impersonate_user_email : null;

    if (!work_date || rows.length === 0) {
      return jsonResponse({
        success: false,
        requestId,
        step: 'validate',
        errorMessage: 'work_date と rows（配列）が必要です（rows要素はobjectである必要があります）',
        work_date,
        rowsRawType: typeof rowsRaw,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
        rows_sample_0: rowsArr[0],
      });
    }

    // service role（書き込み＆管理者検索用）
    const writer = base44.asServiceRole ? base44.asServiceRole : base44;

    step = 'effectiveUser';
    let effectiveUser = user;
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;

    if (impersonate_user_email && isAdmin) {
      const impRes = await writer.entities.User.filter({ email: impersonate_user_email });
      const impersonated = asArray(impRes).filter(isRecord);
      if (impersonated.length > 0) {
        effectiveUser = impersonated[0];
        console.log(`🎭 Impersonating for save: ${impersonate_user_email}`);
      }
    }

    const userEmail = effectiveUser.email;
    const userName = effectiveUser.full_name || effectiveUser.name || String(userEmail).split('@')[0];
    const departmentCode = effectiveUser.department_code ?? null;

    console.log('📝 Saving daily log:', {
      requestId,
      work_date,
      user_email: userEmail,
      department_code: departmentCode,
      rows_count_in: rowsArr.length,
      rows_count_parsed: rows.length,
    });

    step = 'loadExisting';
    let existingLogs = [];
    let existingLoadError = null;
    
    try {
      // list→JS絞り込みに切り替え（filter が例外を投げる可能性があるため）
      const allRes = await writer.entities.WorkLog.list('-work_date', 5000);
      const all = asArray(allRes).filter(isRecord);
      existingLogs = all.filter(l => 
        normalizeDate(l.work_date) === work_date && 
        l.user_email === userEmail
      );
      console.log(`✅ Loaded ${existingLogs.length} existing logs for ${work_date} / ${userEmail}`);
    } catch (e) {
      const info = getErrorInfo(e);
      existingLoadError = { message: info.message, stack: info.stack };
      console.warn(`⚠️ Failed to load existing logs, continuing with create-only mode:`, info.message);
      existingLogs = [];
    }

    const existingIds = existingLogs
      .map((log) => (typeof log.id === 'string' ? log.id : null))
      .filter((id) => typeof id === 'string');

    const savedIds = [];
    const errors = [];

    step = 'saveRows';
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const workCategoryId = pickString(row, [
        'work_category_id',
        'workCategoryId',
        'work_category',
        'category_id',
      ]);

      const duration = toNumber(row.duration_minutes ?? row.minutes);

      if (!workCategoryId || !Number.isFinite(duration) || duration <= 0) {
        continue;
      }

      const status = normalizeStatus(row.status);

      const rowId = typeof row.id === 'string' ? row.id : null;

      const logData = {
        work_date,
        user_email: userEmail,
        user_name: userName,
        department_code: departmentCode,

        client_id: pickString(row, ['client_id']) ?? null,
        client_name: pickString(row, ['client_name']) ?? null,
        project_id: pickString(row, ['project_id']) ?? null,
        project_name: pickString(row, ['project_name']) ?? null,

        is_temporary_project: normalizeBool(row.is_temporary_project),
        work_category_id: String(workCategoryId),
        work_category_name: pickString(row, ['work_category_name']) ?? null,
        is_revision: normalizeBool(row.is_revision),

        duration_minutes: duration,
        description: typeof row.description === 'string' ? row.description : (typeof row.memo === 'string' ? row.memo : ''),

        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      };

      try {
        let savedLog;

        // デバッグ優先：update/delete は使わず「常に create」
        step = 'create';
        savedLog = await writer.entities.WorkLog.create(logData);
        if (isRecord(savedLog) && typeof savedLog.id === 'string') savedIds.push(savedLog.id);

        console.log(`✅ Saved log: ${isRecord(savedLog) ? savedLog.id : '(no id)'}`);
      } catch (e) {
        const info = getErrorInfo(e);
        console.error('❌ Failed to save log:', info.message);

        errors.push({
          index: i,
          row_id: rowId ?? `row_${i}`,
          errorMessage: info.message,
          errorStack: info.stack,
          payloadUsed: logData,
          rowType: typeof row,
        });
      }
    }

    // 削除は一旦無効（デバッグ中に消えるのを防ぐ）
    const idsToDelete = [];

    const savedCount = savedIds.length;
    const success = savedCount > 0 && errors.length === 0;

    step = 'verify';
    let verifySample = [];
    try {
      const verRes = await writer.entities.WorkLog.filter({ work_date, user_email: userEmail });
      verifySample = asArray(verRes).filter(isRecord).slice(0, 5);
    } catch {
      // ignore
    }

    return jsonResponse({
      success,
      requestId,
      saved_count: savedCount,
      deleted_count: idsToDelete.length,
      errors: errors.length ? errors : undefined,
      verifySample,
      _debug: {
        stepEnd: step,
        work_date,
        user_email: userEmail,
        department_code: departmentCode,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
        impersonate_user_email: impersonate_user_email ?? null,
        existingLoadError: existingLoadError,
        existing_count: existingLogs.length,
      },
    });
  } catch (e) {
    const info = getErrorInfo(e);
    console.error('saveDailyLog fatal error:', info.message);

    return jsonResponse({
      success: false,
      requestId,
      step,
      errorMessage: info.message,
      errorStack: info.stack,
    });
  }
});