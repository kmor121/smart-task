/* eslint-disable @typescript-eslint/no-explicit-any */
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

function json(payload: any, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function asArray(v: any): any[] {
  if (Array.isArray(v)) return v;
  if (v && typeof v === "object") {
    if (Array.isArray(v.items)) return v.items;
    if (Array.isArray(v.data)) return v.data;
  }
  return [];
}

function normalizeDate(d: any): string {
  if (!d) return "";
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function toInt(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function strId(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "object" && v !== null) {
    const inner = v.id ?? v.value ?? null;
    return strId(inner);
  }
  const s = String(v).trim();
  if (!s || s === "null" || s === "_none" || s === "undefined") return null;
  return s;
}

function strVal(v: any): string {
  if (v == null) return "";
  return String(v).trim();
}

function fullErrInfo(e: any) {
  let responseBody = null;
  try {
    responseBody = JSON.parse(e?.response?.data ?? e?.responseText ?? null);
  } catch {
    responseBody = e?.response?.data ?? e?.responseText ?? null;
  }
  return {
    message: e?.message ?? String(e),
    name: e?.name ?? null,
    response_status: e?.response?.status ?? e?.status ?? null,
    response_data: responseBody,
    response_headers: e?.response?.headers ?? null,
    stack: e?.stack ?? null,
    json: (() => { try { return JSON.parse(JSON.stringify(e)); } catch { return null; } })(),
  };
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);

    // 1. 認証
    const currentUser = await base44.auth.me();
    if (!currentUser) {
      return json({ success: false, error: "認証が必要です" }, 401);
    }

    // 2. リクエストボディ
    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ success: false, error: "リクエストJSONが不正です" }, 400);
    }

    const work_date = normalizeDate(body.work_date);
    const rowsIn: any[] = Array.isArray(body.rows) ? body.rows : [];
    const impersonate_user_email =
      typeof body.impersonate_user_email === "string" && body.impersonate_user_email
        ? body.impersonate_user_email
        : null;

    if (!work_date) {
      return json({ success: false, error: "work_date が必要です" });
    }
    if (rowsIn.length === 0) {
      return json({ success: false, error: "rows が空です" });
    }

    // 3. serviceRole クライアント
    const writer = (base44 as any).asServiceRole || base44;

    // 4. Impersonation（管理者のみ）
    let effectiveUser: any = currentUser;
    const isAdmin =
      currentUser.role === "admin" ||
      (currentUser as any).isOwner === true ||
      (currentUser as any).isAdmin === true;

    if (impersonate_user_email && isAdmin) {
      try {
        const allUsers = await writer.entities.User.list();
        const users = asArray(allUsers).filter((u: any) => u.email === impersonate_user_email);
        if (users.length > 0) effectiveUser = users[0];
      } catch {
        // impersonation 失敗時は currentUser で続行
      }
    }

    const userEmail: string = effectiveUser.email;
    const userName: string =
      effectiveUser.full_name || effectiveUser.name || String(userEmail).split("@")[0];
    const departmentCode: string = effectiveUser.department_code || "";

    // 5. 行ごとに保存
    const savedIds: string[] = [];
    const errors: any[] = [];

    for (let i = 0; i < rowsIn.length; i++) {
      const row = rowsIn[i];
      if (!row || typeof row !== "object") continue;

      const duration = toInt(row.duration_minutes ?? row.minutes);
      if (!Number.isFinite(duration) || duration <= 0) {
        errors.push({ row_index: i, op: "skip", message: "duration_minutes が 0 以下または不正です" });
        continue;
      }

      const workCategoryId = strId(row.work_category_id ?? row.workCategoryId ?? row.category_id);
      if (!workCategoryId) {
        errors.push({ row_index: i, op: "skip", message: "work_category_id が必要です" });
        continue;
      }

      const rowId = strId(row.id);
      const isSubmit = strVal(row.status).includes("提出");
      const status = isSubmit ? "提出済" : "下書き";

      // ベースデータ（null値を含めない）
      const logData: Record<string, any> = {
        work_date,
        user_email: userEmail,
        user_name: userName,
        work_category_id: workCategoryId,
        work_category_name: strVal(row.work_category_name),
        is_revision: row.is_revision === true,
        is_temporary_project: row.is_temporary_project === true,
        duration_minutes: duration,
        description: strVal(row.description || row.memo),
        status,
      };

      // 空文字でなければ含める
      if (departmentCode) logData.department_code = departmentCode;
      if (isSubmit) logData.submitted_at = new Date().toISOString();

      const clientId = strId(row.client_id);
      if (clientId) {
        logData.client_id = clientId;
        logData.client_name = strVal(row.client_name);
      }

      const projectId = strId(row.project_id);
      if (projectId) {
        logData.project_id = projectId;
        logData.project_name = strVal(row.project_name);
      }

      const op = rowId ? "update" : "create";

      console.log(`[saveDailyLog] row[${i}] op=${op}`, JSON.stringify(logData));

      try {
        if (op === "update") {
          await writer.entities.WorkLog.update(rowId, logData);
          savedIds.push(rowId as string);
        } else {
          const saved = await writer.entities.WorkLog.create(logData);
          console.log(`[saveDailyLog] row[${i}] create result:`, JSON.stringify(saved));
          if (saved?.id) savedIds.push(String(saved.id));
        }
      } catch (e: any) {
        const info = fullErrInfo(e);
        console.error(`[saveDailyLog] row[${i}] ERROR:`, JSON.stringify(info));
        errors.push({
          row_index: i,
          op,
          message: info.message,
          response_status: info.response_status,
          response_data: info.response_data,
          logData_sent: logData,
        });
      }
    }

    const saved_count = savedIds.length;
    const success = saved_count > 0 && errors.length === 0;

    return json({
      success,
      saved_count,
      errors,
      error: success ? undefined : errors.length > 0
        ? `${errors.length} 行でエラーが発生しました`
        : "保存できた行がありませんでした",
    });
  } catch (e: any) {
    const info = fullErrInfo(e);
    return json({ success: false, error: info.message, ...info }, 500);
  }
});