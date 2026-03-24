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
        { success: false, error: "認証が必要です", count: 0, clients: [] },
        { status: 401, headers: corsHeaders }
      );
    }

    const allClients = await base44.asServiceRole.entities.Client.list();

    // is_active が無い/undefined の場合は「有効扱い」にする
    const activeClients = allClients.filter((c) => c.is_active !== false);

    return Response.json(
      {
        success: true,
        clients: activeClients,
        count: activeClients.length,
        _debug: {
          total_count: allClients.length,
          active_count: activeClients.length,
          sample: activeClients[0]
            ? { id: activeClients[0].id, name: activeClients[0].name, is_active: activeClients[0].is_active }
            : null,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error?.message || String(error) || "顧客の取得に失敗しました",
        count: 0,
        clients: [],
      },
      { status: 500, headers: corsHeaders }
    );
  }
});