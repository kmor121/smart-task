import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = user.role === "admin" || user.isOwner === true || user.isAdmin === true;
    const isSubAdmin = user.app_role === "副管理者";
    const isSales = user.department_code === "sales";

    if (!isAdmin && !isSubAdmin && !isSales) {
      return Response.json({ error: 'Forbidden: 営業または管理者のみ案件を編集できます' }, { status: 403 });
    }

    const { projectId, project_date, project_title } = await req.json();

    if (!projectId) {
      return Response.json({ error: '案件IDが必要です' }, { status: 400 });
    }

    if (!project_date) {
      return Response.json({ error: '日付を選択してください' }, { status: 400 });
    }

    const trimmedTitle = (project_title || "").trim();
    if (!trimmedTitle) {
      return Response.json({ error: '案件名を入力してください' }, { status: 400 });
    }

    if (trimmedTitle.length > 200) {
      return Response.json({ error: '案件名は200文字以内で入力してください' }, { status: 400 });
    }

    // 表示用nameを生成
    const name = `${project_date}　${trimmedTitle}`;

    // 案件を更新（存在確認なしで直接update）
    await base44.asServiceRole.entities.Project.update(projectId, {
      project_date,
      project_title: trimmedTitle,
      name
    });

    return Response.json({ 
      success: true,
      message: '案件名を更新しました'
    });

  } catch (error) {
    console.error("updateProject error:", error);
    return Response.json({ error: error.message || '案件の更新に失敗しました' }, { status: 500 });
  }
});