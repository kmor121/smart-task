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
  canRemove
}) {
  const handleChange = (field, value) => {
    const updated = { ...row, [field]: value };

    // 顧客変更時
    if (field === "client_id") {
      const client = clients.find(c => c.id === value);
      updated.client_name = client?.name || "";
      updated.client_id = value || "";
      // 顧客変更時は必ず案件をクリア
      updated.project_id = "";
      updated.project_name = "";
      updated.is_temporary_project = false;
    }

    // 案件変更時
    if (field === "project_id") {
      if (!value || value === "") {
        // クリア時
        updated.project_id = "";
        updated.project_name = "";
        updated.is_temporary_project = false;
      } else {
        // 選択時（必ず文字列で保存）
        const project = projects.find(p => p.id === String(value));
        if (project) {
          updated.project_id = String(project.id);
          updated.project_name = project.name;
          updated.client_name = project.client_name || updated.client_name;
          updated.client_id = project.client_id ? String(project.client_id) : updated.client_id;
          updated.is_temporary_project = project.status === "仮案件";
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
  };

  // アクティブな顧客のみ
  const filteredClients = clients.filter(c => c.is_active === true);

  // アクティブな案件のみ、選択中の顧客に紐づく案件のみ
  const filteredProjects = projects.filter(p => {
    if (p.is_active !== true) return false;
    if (!row.client_id) return false;
    return String(p.client_id) === String(row.client_id);
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
  useEffect(() => {
    if (normalizedProjectId && !isSelectedInOptions && row.client_id) {
      console.log("Auto-clearing invalid project_id:", normalizedProjectId);
      handleChange("project_id", "");
    }
  }, [row.client_id, normalizedProjectId, isSelectedInOptions]);

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

      <div className="grid grid-cols-1 gap-3">
        {/* 顧客（全部署で表示） */}
        <div>
          <label className="text-xs font-medium text-slate-500 mb-1 block">
            顧客 {isSales && <span className="text-red-400">*</span>}
          </label>
          <Select 
            value={row.client_id || ""} 
            onValueChange={v => {
              const clientId = v === "" ? null : v;
              handleChange("client_id", clientId);
            }}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="顧客を選択" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>— 選択してください —</SelectItem>
              {filteredClients.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
            value={currentProjectValue} 
            onValueChange={v => handleChange("project_id", v || "")}
            disabled={!row.client_id}
          >
            <SelectTrigger className={`h-9 text-sm ${
              isProjectInvalid ? "border-red-300 bg-red-50" : 
              row.is_temporary_project ? "border-amber-300 bg-amber-50" : ""
            }`}>
              <SelectValue placeholder={row.client_id ? "案件を選択" : "顧客を選択してください"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={null}>— 選択してください —</SelectItem>
              {filteredProjects.length === 0 ? (
                <div className="px-2 py-6 text-center text-sm text-slate-400">
                  該当する案件がありません
                </div>
              ) : (
                filteredProjects.map(p => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {isSales && (
            <button
              type="button"
              onClick={onCreateNewProject}
              className="text-xs text-blue-600 hover:text-blue-700 mt-1 inline-flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              新規案件作成
            </button>
          )}
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