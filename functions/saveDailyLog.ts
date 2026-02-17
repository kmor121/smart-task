/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function isObj(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

function asArray(v) {
  if (Array.isArray(v)) return v;
  if (isObj(v) && Array.isArray(v.items)) return v.items;
  if (isObj(v) && Array.isArray(v.data)) return v.data;
  return [];
}

function normalizeDate(d) {
  if (!d) return "";
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function normalizeBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return ["true", "1", "yes", "on"].includes(v.toLowerCase());
  return false;
}

function toInt(v) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

// ★重要：DBの実値に合わせる（提出ボタン/下書き保存に合わせる）
function normalizeStatus(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "下書き";
  if (s === "submitted") return "提出済";
  if (s === "draft") return "下書き";
  if (s.includes("提出")) return "提出済";
  if (s.includes("下書")) return "下書き";
  return s;
}

function pickStr(obj, key) {
  if (!isObj(obj)) return null;
  const v = obj[key];
  if (v == null) return null;
  if (typeof v === "string" && v.trim() !== "") return v;
  if (typeof v === "number") return String(v);
  return null;
}

function errInfo(e) {
  return {
    message: e?.message ?? String(e),
    stack: e?.stack ?? null,
    response_status: e?.response?.status ?? null,
    response_data: e?.response?.data ?? null,
  };
}

Deno.serve(async (req) => {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let step = "start";

  try {
    const base44 = createClientFromRequest(req);

    step = "auth";
    const user = await base44.auth.me();
    if (!user) {
      return json({ success: false, requestId, step, error: "認証が必要です" });
    }

    step = "parseBody";
    let body = null;
    try {
      body = await req.json();
    } catch {
      body = null;
    }
    if (!isObj(body)) {
      return json({ success: false, requestId, step, error: "リクエストJSONが不正です", bodyType: typeof body });
    }

    const work_date = normalizeDate(body.work_date ?? body.date ?? body.log_date ?? body.logDate);

    const rowsIn = body.rows ?? body.items ?? body.entries ?? [];
    const rowsArr = Array.isArray(rowsIn) ? rowsIn : [rowsIn];

    // rows要素が JSON文字列で来ても復元
    const rows = rowsArr
      .map((r) => {
        if (typeof r === "string") {
          try { return JSON.parse(r); } catch { return null; }
        }
        return r;
      })
      .filter(isObj);

    const impersonate_user_email = typeof body.impersonate_user_email === "string" ? body.impersonate_user_email : null;

    if (!work_date || rows.length === 0) {
      return json({
        success: false,
        requestId,
        step: "validate",
        error: "work_date と rows（配列）が必要です（rows要素はobjectである必要があります）",
        work_date,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
      });
    }

    // service role（書き込み＆管理者検索用）
    const writer = base44.asServiceRole || base44;

    step = "effectiveUser";
    let effectiveUser = user;

    const isAdmin = user.role === "admin" || user.isAdmin === true || user.isOwner === true;
    if (impersonate_user_email && isAdmin) {
      try {
        const impRes = await writer.entities.User.filter({ email: impersonate_user_email });
        const impersonated = asArray(impRes);
        if (impersonated.length > 0) effectiveUser = impersonated[0];
      } catch {
        // 失敗しても保存は続行
      }
    }

    const userEmail = effectiveUser.email;
    const userName = effectiveUser.full_name || effectiveUser.name || String(userEmail).split("@")[0];
    const departmentCode = effectiveUser.department_code || "";

    // 既存取得（list + JS絞り込み）
    step = "loadExisting";
    let existingIds = [];
    let existingLoadError = null;
    try {
      const allLogs = await writer.entities.WorkLog.list('-created_date', 5000);
      const existingLogs = asArray(allLogs).filter((l) => 
        l && l.work_date === work_date && l.user_email === userEmail
      );
      existingIds = existingLogs.map((l) => l?.id).filter((id) => typeof id === "string");
    } catch (e) {
      existingLoadError = errInfo(e);
      existingIds = [];
    }

    const savedIds = [];
    const errors = [];

    step = "saveRows";
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      const workCategoryId =
        pickStr(row, "work_category_id") ||
        pickStr(row, "workCategoryId") ||
        pickStr(row, "category_id") ||
        pickStr(row, "work_category");

      const duration = toInt(row.duration_minutes ?? row.minutes);

      if (!workCategoryId || !Number.isFinite(duration) || duration <= 0) continue;

      const status = normalizeStatus(row.status);
      const rowId = typeof row.id === "string" ? row.id : null;

      const logData = {
        work_date,
        user_email: userEmail,
        user_name: userName,
        department_code: departmentCode,

        client_id: pickStr(row, "client_id"),
        client_name: pickStr(row, "client_name"),
        project_id: pickStr(row, "project_id"),
        project_name: pickStr(row, "project_name"),

        is_temporary_project: normalizeBool(row.is_temporary_project),
        work_category_id: String(workCategoryId),
        work_category_name: pickStr(row, "work_category_name"),
        is_revision: normalizeBool(row.is_revision),

        duration_minutes: duration,
        description: typeof row.description === "string" ? row.description : (typeof row.memo === "string" ? row.memo : ""),

        // ★必ず日本語の値に寄せる
        status,
        submitted_at: status === "提出済" ? new Date().toISOString() : null,
      };

      const op = rowId && existingIds.includes(rowId) ? "update" : "create";

      try {
        let saved = null;
        if (op === "update") {
          saved = await writer.entities.WorkLog.update(rowId, logData);
          savedIds.push(rowId);
        } else {
          saved = await writer.entities.WorkLog.create(logData);
          if (saved && typeof saved.id === "string") savedIds.push(saved.id);
        }
      } catch (e) {
        const info = errInfo(e);

        // DailyLog.js表示用の形式
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

    step = "done";
    const saved_count = savedIds.length;
    const success = saved_count > 0 && errors.length === 0;

    return json({
      success,
      requestId,
      step,
      saved_count,
      deleted_count: 0,
      error: success ? undefined : `保存中にエラーが発生しました (${errors.length}件)`,
      errors: errors.length > 0 ? errors : [],
      _debug: {
        work_date,
        user_email: userEmail,
        department_code: departmentCode,
        rows_in: rowsArr.length,
        rows_parsed: rows.length,
        is_admin: isAdmin,
        impersonate_user_email,
        existingLoadError,
      },
    });
  } catch (e) {
    const info = errInfo(e);
    return json({
      success: false,
      requestId,
      step,
      error: info.message,
      errorStack: info.stack,
      response_status: info.response_status,
      response_data: info.response_data,
    });
  }
});