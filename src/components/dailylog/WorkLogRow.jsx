import React, { useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

export default function WorkLogRow({
  row,
  index,
  clients,
  projects,
  workCategories,
  userDepartmentCode,
  isSales,
  onChange,
  onRemove,
  onCreateNewProject,
  onCreateNewClient,
  canRemove,
  canManageProjects,
  onEditProject
}) {
  const [lastClientSelected, setLastClientSelected] = React.useState("");
  const [lastProjectSelected, setLastProjectSelected] = React.useState("");

  const handleChange = (field, value) => {
    console.log(`[WorkLogRow ${index}] handleChange called`, { field, value, before_client: row.client_id, before_project: row.project_id });
    const updated = { ...row, [field]: value };

    // 顧客変更時
    if (field === "client_id") {
      const clientId = String(value || "");
      const client = clients.find(c => String(c.id) === clientId);
      updated.client_id = clientId;
      updated.client_name = client?.name || "";
      // 顧客変更時は必ず案件をクリア
      updated.project_id = "";
      updated.project_name = "";
      updated.is_temporary_project = false;
      setLastClientSelected(clientId);
      console.log(`[WorkLogRow ${index}] ✅ Client selected:`, clientId, client?.name);
    }

    // 案件変更時
    if (field === "project_id") {
      const projectId = String(value || "");
      if (!projectId) {
        // クリア時
        updated.project_id = "";
        updated.project_name = "";
        updated.is_temporary_project = false;
      } else {
        // 選択時（必ず文字列で保存）
        const project = projects.find(p => String(p.id) === projectId);
        if (project) {
          const displayName = project.project_date && project.project_title
            ? `${project.project_date} ${project.project_title}`
            : (project.project_title || project.name || "");
          updated.project_id = projectId;
          updated.project_name = displayName;
          updated.client_name = project.client_name || updated.client_name;
          updated.client_id = project.client_id ? String(project.client_id) : updated.client_id;
          updated.is_temporary_project = project.status === "仮案件";
          setLastProjectSelected(projectId);
          console.log(`[WorkLogRow ${index}] ✅ Project selected:`, projectId, displayName);
        } else {
          // 存在しない場合はクリア
          updated.project_id = "";
          updated.project_name = "";
          updated.is_temporary_project = false;
        }
      }
    }

    // 作業区分変更時
    if (field === "work_category_id") {
      const cat = workCategories.find(c => c.id === value);
      updated.work_category_name = cat?.name || "";
      updated.is_revision = cat?.is_revision || false;
    }

    onChange(index, updated);
    console.log(`[WorkLogRow ${index}] onChange called with:`, updated);
  };

  // アクティブな顧客のみ
  const filteredClients = clients.filter(c => c.is_active === true);

  // アクティブな案件のみ、選択中の顧客に紐づく案件のみ
  // client_id が null の場合は client_name でもフォールバック照合
  const selectedClient = clients.find(c => String(c.id) === String(row.client_id || ""));
  const filteredProjects = projects.filter(p => {
    if (p.is_active !== true) return false;
    if (!row.client_id) return false;
    if (p.client_id && String(p.client_id) === String(row.client_id)) return true;
    if (!p.client_id && selectedClient && p.client_name === selectedClient.name) return true;
    return false;
  });

  // 案件 options の value(id) 配列を作成（文字列に統一）
  const projectOptionsIds = filteredProjects.map(p => String(p.id));
  
  // 選択中の project_id が options に存在するかチェック
  const normalizedProjectId = row.project_id || "";
  const isSelectedInOptions = normalizedProjectId && projectOptionsIds.includes(normalizedProjectId);
  
  // value は必ず Project.id（文字列）または空文字列
  const currentProjectValue = isSelectedInOptions ? normalizedProjectId : "";
  
  // 必須判定（営業部のみ案件が必須 かつ 未選択 or options に存在しない）
  const isProjectInvalid = isSales && (!normalizedProjectId || !isSelectedInOptions);
  
  // 顧客必須判定（営業部のみ）
  const isClientInvalid = isSales && !row.client_id;

  // 無効な project_id を自動的にクリア（顧客変更時または案件が無効になった時）
  // ⚠️ このuseEffectが選択を上書きしている可能性があるため、一旦コメントアウト
  // useEffect(() => {
  //   if (normalizedProjectId && !isSelectedInOptions && row.client_id) {
  //     console.log("Auto-clearing invalid project_id:", normalizedProjectId);
  //     handleChange("project_id", "");
  //   }
  // }, [row.client_id, normalizedProjectId, isSelectedInOptions]);

  // 部署コード正規化（design→production, print→printing）
  const DEPT_ALIAS = { design: 'production', print: 'printing' };
  const normalizedDeptCode = DEPT_ALIAS[userDepartmentCode] ?? userDepartmentCode;
  
  // ユーザーの部署に合った作業区分 + 共通区分
  const filteredCategories = workCategories.filter(c => {
    if (!c.is_active) return false;
    return c.department_code === "common" || c.department_code === normalizedDeptCode;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">本日の作業 {index + 1}</span>
        {canRemove && (
          <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600 hover:bg-red-50 h-7 w-7 p-0">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* デバッグ情報表示 */}
      <div className="bg-amber-50 border border-amber-200 rounded p-2 text-[10px] font-mono space-y-0.5">
        <div className="font-semibold text-amber-800">🔍 Debug Info:</div>
        <div>row.client_id: "{String(row.client_id || "")}" (last: "{lastClientSelected}")</div>
        <div>row.project_id: "{String(row.project_id || "")}" (last: "{lastProjectSelected}")</div>
        <div>Select value: client="{String(row.client_id || "")}" project="{String(currentProjectValue)}"</div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* 顧客（全部署で表示） */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            顧客 {isSales && <span className="text-red-400">*</span>}
          </label>
          <Select 
            value={String(row.client_id || "")} 
            onValueChange={(v) => handleChange("client_id", v)}
          >
            <SelectTrigger className={`h-9 text-sm ${isClientInvalid ? "border-red-300 bg-red-50" : ""}`}>
              <SelectValue placeholder="顧客を選択" />
            </SelectTrigger>
            <SelectContent>
              {filteredClients.map(c => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isSales && (
            <button
              type="button"
              onClick={onCreateNewClient}
              className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer mt-1"
            >
              <Plus className="w-3 h-3" />
              新規顧客作成
            </button>
          )}
        </div>

        {/* 案件（全部署で表示） */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 flex items-center gap-1.5">
            案件 {isSales && <span className="text-red-400">*</span>}
            {isProjectInvalid && (
              <span className="text-red-500 text-xs">⚠️</span>
            )}
          </label>
          <Select 
            value={String(currentProjectValue)} 
            onValueChange={(v) => handleChange("project_id", v)}
            disabled={!row.client_id}
          >
            <SelectTrigger className={`h-9 text-sm ${
              isProjectInvalid ? "border-red-300 bg-red-50" : 
              row.is_temporary_project ? "border-amber-300 bg-amber-50" : ""
            }`}>
              <SelectValue placeholder={row.client_id ? "案件を選択" : "顧客を選択してください"} />
            </SelectTrigger>
            <SelectContent>
              {filteredProjects.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-slate-400">
                  該当する案件がありません
                </div>
              ) : (
                filteredProjects.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.project_date && p.project_title
                      ? `${p.project_date} ${p.project_title}`
                      : (p.project_title || p.name || p.id)}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 mt-1">
            {isSales && (
              <button
                type="button"
                onClick={onCreateNewProject}
                className="text-xs text-blue-600 hover:text-blue-700 inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                新規案件作成
              </button>
            )}
            {canManageProjects && row.project_id && (
              <button
                type="button"
                onClick={() => onEditProject?.(row.project_id)}
                className="text-xs text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 cursor-pointer"
              >
                案件名を編集
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* 作業区分 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">作業区分 <span className="text-red-400">*</span></label>
          <Select value={row.work_category_id || "_none"} onValueChange={v => handleChange("work_category_id", v === "_none" ? "" : v)}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="作業区分を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">— 選択してください —</SelectItem>
              {filteredCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 作業時間 */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">作業時間（分） <span className="text-red-400">*</span></label>
          <Input
            type="number"
            min="0"
            max="999"
            value={row.duration_minutes ?? ""}
            onChange={e => {
              const val = e.target.value;
              handleChange("duration_minutes", val === "" ? 0 : parseInt(val) || 0);
            }}
            className="h-9 text-sm"
            placeholder="0"
          />
        </div>
        </div>
        </div>

      {/* 作業詳細 */}
      <div>
        <label className="text-xs font-medium text-slate-500 mb-1 block">作業詳細</label>
        <Textarea
          value={row.description || ""}
          onChange={e => handleChange("description", e.target.value)}
          className="text-sm min-h-[60px] resize-none"
          placeholder="作業内容を入力..."
        />
      </div>
    </div>
  );
}