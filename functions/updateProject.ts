import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 権限チェック：営業部、管理者、副管理者のみ
    const isAdmin = user.role === "admin" || user.isOwner === true || user.isAdmin === true;
    const isSubAdmin = user.app_role === "副管理者";
    const isSales = user.department_code === "sales";

    if (!isAdmin && !isSubAdmin && !isSales) {
      return Response.json({ error: 'Forbidden: 営業または管理者のみ案件を編集できます' }, { status: 403 });
    }

    const { projectId, name } = await req.json();

    // バリデーション
    if (!projectId) {
      return Response.json({ error: '案件IDが必要です' }, { status: 400 });
    }

    const trimmedName = (name || "").trim();
    if (!trimmedName) {
      return Response.json({ error: '案件名を入力してください' }, { status: 400 });
    }

    if (trimmedName.length > 200) {
      return Response.json({ error: '案件名は200文字以内で入力してください' }, { status: 400 });
    }

    // 案件を取得（存在確認）
    const existingProject = await base44.asServiceRole.entities.Project.filter({ id: projectId });
    if (!existingProject || existingProject.length === 0) {
      return Response.json({ error: '案件が見つかりません' }, { status: 404 });
    }

    // 案件名を更新
    await base44.asServiceRole.entities.Project.update(projectId, {
      name: trimmedName
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