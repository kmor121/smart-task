import { createClientFromRequest } from "npm:@base44/sdk@0.8.6";

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

    const allProjects = await base44.entities.Project.list();


    // Project に is_active が無い可能性が高いので「false以外＝有効」で扱う
    let activeProjects = allProjects.filter((p) => p.is_active !== false);

    if (client_id) {
      activeProjects = activeProjects.filter(
        (p) => String(p.client_id) === String(client_id)
      );
    }

    return Response.json(
      {
        success: true,
        projects: activeProjects,
        count: activeProjects.length,
        filter: client_id ? { client_id } : null,
        _debug: {
          total_count: allProjects.length,
          active_count: allProjects.filter((p) => p.is_active !== false).length,
          filtered_count: activeProjects.length,
          client_id_filter: client_id || null,
          sample: activeProjects[0]
            ? {
                id: activeProjects[0].id,
                project_title: activeProjects[0].project_title,
                name: activeProjects[0].name,
                project_date: activeProjects[0].project_date,
                client_id: activeProjects[0].client_id,
                is_active: activeProjects[0].is_active,
              }
            : null,
        },
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
