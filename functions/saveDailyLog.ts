/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function parseJsonMaybe(v: any) {
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.items)) return v.items;
  if (v && Array.isArray(v.data)) return v.data;
  return [];
}

function normalizeDate(d: any): string {
  if (!d) return '';
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeBool(v: any): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') return ['true', '1', 'yes', 'on'].includes(v.toLowerCase());
  return false;
}

function normalizeStatus(raw: any): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'draft';
  if (s.includes('提出')) return 'submitted';
  if (s.includes('下書')) return 'draft';
  return s;
}

Deno.serve(async (req: Request) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let step = 'start';

  try {
    const base44 = createClientFromRequest(req);

    step = 'auth';
    const user = await base44.auth.me();
    if (!user) {
      return new Response(JSON.stringify(
        { success: false, requestId, step, errorMessage: '認証が必要です' }
      ), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    step = 'parseBody';
    let body: any = await req.json();
    body = parseJsonMaybe(body);

    if (!body || typeof body !== 'object') {
      return new Response(JSON.stringify(
        { success: false, requestId, step, errorMessage: 'リクエストJSONが不正です', bodyType: typeof body, body }
      ), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const work_date = normalizeDate(body.work_date ?? body.log_date ?? body.logDate ?? body.date);

    let rowsRaw: any = body.rows ?? body.items ?? body.entries ?? [];
    rowsRaw = parseJsonMaybe(rowsRaw);

    const rowsArr: any[] = Array.isArray(rowsRaw) ? rowsRaw : [rowsRaw];

    const rows = rowsArr
      .map((r) => parseJsonMaybe(r))
      .map((r) => (typeof r === 'string' ? parseJsonMaybe(r) : r))
      .filter((r) => r && typeof r === 'object');

    const impersonate_user_email = body.impersonate_user_email;

    if (!work_date || rows.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        requestId,
        step: 'validate',
        errorMessage: 'work_date と rows（配列）が必要です（rows要素はobjectである必要があります）',
        work_date,
        rowsRawType: typeof rowsRaw,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }

    const writer = (base44 as any).asServiceRole ?? base44;

    step = 'effectiveUser';
    let effectiveUser: any = user;
    const isAdmin = user.role === 'admin' || user.isAdmin === true || user.isOwner === true;

    if (impersonate_user_email && isAdmin) {
      const impRes = await writer.entities.User.filter({ email: impersonate_user_email });
      const impersonated = asArray(impRes);
      if (impersonated.length > 0) {
        effectiveUser = impersonated[0];
        console.log(`🎭 Impersonating for save: ${impersonate_user_email}`);
      }
    }

    const userEmail = effectiveUser.email;
    const userName = effectiveUser.full_name || effectiveUser.name || userEmail.split('@')[0];
    const departmentCode = effectiveUser.department_code || null;

    console.log('📝 Saving daily log:', {
      requestId,
      work_date,
      user_email: userEmail,
      department_code: departmentCode,
      rows_count_in: rowsArr.length,
      rows_count_parsed: rows.length,
    });

    // 既存ログ（※ここでfilterが不安なら list→JS絞り込みに後で変更可）
    step = 'loadExisting';
    const existingRes = await writer.entities.WorkLog.filter({ work_date, user_email: userEmail });
    const existingLogs = asArray(existingRes);
    const existingIds = existingLogs.map((log: any) => log.id).filter(Boolean);

    const savedIds: string[] = [];
    const errors: any[] = [];

    step = 'saveRows';
    for (let i = 0; i < rows.length; i++) {
      const row: any = rows[i];

      const workCategoryId =
        row.work_category_id ?? row.workCategoryId ?? row.work_category ?? row.category_id ?? null;

      const duration = Number(row.duration_minutes ?? row.minutes ?? 0);

      if (!workCategoryId || !Number.isFinite(duration) || duration <= 0) {
        continue;
      }

      const status = normalizeStatus(row.status);

      const logData: any = {
        work_date,
        user_email: userEmail,
        user_name: userName,
        department_code: departmentCode,

        client_id: row.client_id ?? null,
        client_name: row.client_name ?? null,
        project_id: row.project_id ?? null,
        project_name: row.project_name ?? null,

        is_temporary_project: normalizeBool(row.is_temporary_project),
        work_category_id: String(workCategoryId),
        work_category_name: row.work_category_name ?? null,
        is_revision: normalizeBool(row.is_revision),

        duration_minutes: duration,
        description: row.description ?? row.memo ?? '',

        status,
        submitted_at: status === 'submitted' ? new Date().toISOString() : null,
      };

      try {
        let savedLog: any;

        if (row.id && existingIds.includes(row.id)) {
          step = 'update';
          savedLog = await writer.entities.WorkLog.update(row.id, logData);
          savedIds.push(row.id);
        } else {
          step = 'create';
          savedLog = await writer.entities.WorkLog.create(logData);
          if (savedLog?.id) savedIds.push(savedLog.id);
        }

        console.log(`✅ Saved log: ${savedLog?.id ?? '(no id)'}`);
      } catch (e) {
        console.error('❌ Failed to save log:', e);
        const err = e as any;
        errors.push({
          index: i,
          row_id: row.id ?? `row_${i}`,
          errorMessage: err?.message ?? String(e),
          errorStack: err?.stack ?? null,
          payloadUsed: logData,
          rowType: typeof row,
        });
      }
    }

    // まずは削除は無効化（デバッグ中に消えるのを防ぐ）
    const idsToDelete: string[] = [];

    // ★成功条件：1件以上保存でき、エラー0
    const savedCount = savedIds.filter(Boolean).length;
    const success = savedCount > 0 && errors.length === 0;

    step = 'verify';
    let verifySample: any[] = [];
    try {
      const verRes = await writer.entities.WorkLog.filter({ work_date, user_email: userEmail });
      verifySample = asArray(verRes).slice(0, 5);
    } catch {
      // ignore
    }

    return new Response(JSON.stringify({
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
      },
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  } catch (e) {
    console.error('saveDailyLog fatal error:', e);
    const err = e as any;
    return new Response(JSON.stringify({
      success: false,
      requestId,
      step,
      errorMessage: err?.message ?? String(e),
      errorStack: err?.stack ?? null,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
});