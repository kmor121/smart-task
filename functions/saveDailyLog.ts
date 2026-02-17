// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function isObj(v) {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function parseJsonMaybe(v) {
  if (typeof v === 'string') {
    try { return JSON.parse(v); } catch { return v; }
  }
  return v;
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (isObj(v) && Array.isArray(v.items)) return v.items;
  if (isObj(v) && Array.isArray(v.data)) return v.data;
  return [];
}

function normalizeDate(d) {
  const s = String(d ?? '').trim();
  if (!s) return '';
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeStatus(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '下書き';
  if (s.includes('提出')) return '提出済';
  if (s.includes('下書')) return '下書き';
  if (s === '提出済' || s === '下書き') return s;
  return s;
}

function toInt(v) {
  const n = Number.parseInt(String(v ?? ''), 10);
  return Number.isFinite(n) ? n : NaN;
}

function compact(obj) {
  const o = {};
  for (const k of Object.keys(obj)) {
    const val = obj[k];
    if (val !== undefined && val !== null) o[k] = val;
  }
  return o;
}

function errInfo(e) {
  if (e && typeof e === 'object') {
    return {
      message: String(e.message ?? e.toString?.() ?? e),
      stack: e.stack ? String(e.stack) : null,
    };
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
      return json({ success: false, requestId, step, error: '認証が必要です' }, 200);
    }

    step = 'parseBody';
    let body = await req.json();
    body = parseJsonMaybe(body);
    if (!isObj(body)) {
      return json({ success: false, requestId, step, error: 'リクエストJSONが不正です', body }, 200);
    }

    const work_date = normalizeDate(body.work_date ?? body.log_date ?? body.logDate ?? body.date);

    let rowsRaw = body.rows ?? body.items ?? body.entries ?? [];
    rowsRaw = parseJsonMaybe(rowsRaw);
    const rowsArr = Array.isArray(rowsRaw) ? rowsRaw : [rowsRaw];

    const rows = rowsArr
      .map((r) => parseJsonMaybe(r))
      .map((r) => (typeof r === 'string' ? parseJsonMaybe(r) : r))
      .filter((r) => isObj(r));

    const impersonate_user_email =
      typeof body.impersonate_user_email === 'string' ? body.impersonate_user_email : null;

    if (!work_date || rows.length === 0) {
      return json({
        success: false,
        requestId,
        step: 'validate',
        error: 'work_date と rows（配列）が必要です（rows要素はobjectである必要があります）',
        work_date,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
        rows_sample_0: rowsArr[0] ?? null,
      }, 200);
    }

    step = 'writer';
    const writer = (base44.asServiceRole && base44.asServiceRole.entities) ? base44.asServiceRole : base44;

    step = 'effectiveUser';
    let effectiveUser = user;
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;

    if (impersonate_user_email && isAdmin) {
      try {
        const impRes = await writer.entities.User.filter({ email: impersonate_user_email });
        const impersonated = asArray(impRes);
        if (impersonated.length > 0) effectiveUser = impersonated[0];
      } catch (e) {
        // 失敗しても本処理は止めない
        console.log('impersonate lookup failed:', errInfo(e).message);
      }
    }

    const userEmail = String(effectiveUser.email ?? '');
    const userName = String(effectiveUser.full_name ?? effectiveUser.name ?? userEmail.split('@')[0] ?? '');
    const departmentCode = String(effectiveUser.department_code ?? '');

    step = 'loadExisting';
    let existingLogs = [];
    let existingLoadError = null;

    // ★ filter が落ちるケースがあるので list() で取って JS で絞る
    try {
      const all = await writer.entities.WorkLog.list('-created_date', 5000, 0, ['id', 'work_date', 'user_email']);
      existingLogs = asArray(all).filter((x) =>
        isObj(x) &&
        normalizeDate(x.work_date) === work_date &&
        String(x.user_email ?? '') === userEmail
      );
    } catch (e) {
      existingLoadError = errInfo(e).message;
      existingLogs = [];
    }

    const existingIds = existingLogs.map((x) => x.id).filter(Boolean);

    step = 'saveRows';
    const savedIds = [];
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const work_category_id =
        row.work_category_id ?? row.workCategoryId ?? row.work_category ?? row.category_id ?? null;

      const duration_minutes = toInt(row.duration_minutes ?? row.minutes);

      if (!work_category_id || !Number.isFinite(duration_minutes) || duration_minutes <= 0) {
        continue;
      }

      const rowId = typeof row.id === 'string' ? row.id : null;
      const op = (rowId && existingIds.includes(rowId)) ? 'update' : 'create';

      const status = normalizeStatus(row.status);

      const logData = compact({
        work_date,
        user_email: userEmail,
        user_name: userName,
        department_code: departmentCode,

        client_id: row.client_id ?? '',
        client_name: row.client_name ?? '',
        project_id: row.project_id ?? '',
        project_name: row.project_name ?? '',
        is_temporary_project: !!row.is_temporary_project,

        work_category_id: String(work_category_id),
        work_category_name: row.work_category_name ?? '',
        is_revision: !!row.is_revision,

        duration_minutes,
        description: row.description ?? '',
        status, // 「下書き」 or 「提出済」
      });

      try {
        let saved;
        if (op === 'update') {
          saved = await writer.entities.WorkLog.update(rowId, logData);
          savedIds.push(rowId);
        } else {
          saved = await writer.entities.WorkLog.create(logData);
          if (saved && saved.id) savedIds.push(saved.id);
        }
      } catch (e) {
        const info = errInfo(e);
        errors.push({
          index: i,
          row_id: rowId ?? `row_${i}`,
          op,
          error: info.message,
          stack: info.stack,
          data: logData,
        });
      }
    }

    const success = errors.length === 0;

    return json({
      success,
      requestId,
      step: 'done',
      saved_count: savedIds.length,
      deleted_count: 0,
      error: success ? undefined : `保存中にエラーが発生しました（${errors.length}件）`,
      errors: errors.length ? errors : undefined,
      _debug: {
        work_date,
        user_email: userEmail,
        department_code: departmentCode,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
        existing_loaded: existingLogs.length,
        existingLoadError,
        impersonate_user_email: impersonate_user_email ?? null,
      },
    }, 200);

  } catch (e) {
    const info = errInfo(e);
    return json({
      success: false,
      requestId,
      step,
      error: info.message,
      errors: [{ index: -1, row_id: 'fatal', op: 'fatal', error: info.message, stack: info.stack }],
    }, 200);
  }
});
