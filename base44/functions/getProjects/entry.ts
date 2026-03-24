import { createClientFromRequest } from "npm:@base44/sdk@0.8.20";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
  "Cache-Control": "no-store",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json(
        { success: false, error: "認証が必要です", count: 0, projects: [] },
        { status: 401, headers: corsHeaders }
      );
    }

    const body =
      req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const client_id = body?.client_id;

    const allProjects = await base44.asServiceRole.entities.Project.list();

    // include_inactive=true の場合は全件返す（案件管理ページ用）
    const includeInactive = body?.include_inactive === true;

    let resultProjects = includeInactive
      ? allProjects
      : allProjects.filter((p) => p.is_active !== false);

    if (client_id) {
      resultProjects = resultProjects.filter(
        (p) => String(p.client_id) === String(client_id)
      );
    }

    return Response.json(
      {
        success: true,
        projects: resultProjects,
        count: resultProjects.length,
        filter: client_id ? { client_id } : null,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error?.message || String(error) || "案件の取得に失敗しました",
        count: 0,
        projects: [],
      },
      { status: 500, headers: corsHeaders }
    );
  }
});