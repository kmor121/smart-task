import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, Pencil } from "lucide-react";

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
  onEditProject,
}) {
  const handleChange = (field, value) => {
    const updated = { ...row, [field]: value };
    onChange(index, updated);
  };

  const handleClientChange = (clientId) => {
    if (clientId === "__new__") {
      onCreateNewClient();
      return;
    }
    const client = (Array.isArray(clients) ? clients : []).find(c => c.id === clientId);
    onChange(index, {
      ...row,
      client_id: clientId,
      client_name: client?.name || "",
      project_id: "",
      project_name: "",
    });
  };

  const handleProjectChange = (projectId) => {
    if (projectId === "__new__") {
      onCreateNewProject();
      return;
    }
    const projectsArr = Array.isArray(projects) ? projects : [];
    const project = projectsArr.find(p => p.id === projectId);
    onChange(index, {
      ...row,
      project_id: projectId,
      project_name: project
        ? (project.project_title
            ? `${project.project_date} ${project.project_title}`
            : project.name || "")
        : "",
      is_temporary_project: project?.status === "仮案件" || false,
    });
  };

  const handleCategoryChange = (categoryId) => {
    const category = (Array.isArray(workCategories) ? workCategories : []).find(c => c.id === categoryId);
    onChange(index, {
      ...row,
      work_category_id: categoryId,
      work_category_name: category?.name || "",
      is_revision: category?.is_revision || false,
    });
  };

  // Filter categories by department
  const filteredCategories = (Array.isArray(workCategories) ? workCategories : []).filter(c => {
    if (c.is_active === false) return false;
    if (!c.department_code) return true; // 共通
    return c.department_code === userDepartmentCode;
  });

  // Filter clients
  const activeClients = (Array.isArray(clients) ? clients : []).filter(c => c.is_active !== false);

  // Filter projects by selected client
  const projectsArr = Array.isArray(projects) ? projects : [];
  const filteredProjects = row.client_id
    ? projectsArr.filter(p => p.is_active !== false && p.client_id === row.client_id)
    : projectsArr.filter(p => p.is_active !== false);

  const isMissing = (field) => {
    if (isSales) {
      return !row.client_id || !row.project_id || !row.work_category_id || !row.duration_minutes;
    }
    return !row.work_category_id || !row.duration_minutes;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">作業 {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onRemove(index);
            }}
            className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors"
            title="この行を削除"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 顧客・案件（営業部または全部署） */}
      {isSales && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* 顧客 */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">顧客 <span className="text-red-400">*</span></label>
            <Select value={row.client_id || ""} onValueChange={handleClientChange}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="顧客を選択" />
              </SelectTrigger>
              <SelectContent>
                {activeClients.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
                <SelectItem value="__new__">
                  <span className="text-blue-600 flex items-center gap-1">
                    <Plus className="w-3 h-3" /> 新規顧客作成
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 案件 */}
          <div>
            <label className="text-xs text-slate-500 mb-1 block">
              案件 <span className="text-red-400">*</span>
              {row.project_id && canManageProjects && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onEditProject(row.project_id);
                  }}
                  className="ml-2 text-slate-400 hover:text-slate-600"
                  title="案件名を編集"
                >
                  <Pencil className="w-3 h-3 inline" />
                </button>
              )}
            </label>
            <Select value={row.project_id || ""} onValueChange={handleProjectChange}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="案件を選択" />
              </SelectTrigger>
              <SelectContent>
                {filteredProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.project_title
                      ? `${p.project_date} ${p.project_title}`
                      : p.name || p.project_title || p.id}
                  </SelectItem>
                ))}
                {canManageProjects && (
                  <SelectItem value="__new__">
                    <span className="text-blue-600 flex items-center gap-1">
                      <Plus className="w-3 h-3" /> 新規案件作成
                    </span>
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* 作業区分・作業時間 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* 作業区分 */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">作業区分 <span className="text-red-400">*</span></label>
          <Select value={row.work_category_id || ""} onValueChange={handleCategoryChange}>
            <SelectTrigger className="text-sm">
              <SelectValue placeholder="作業区分を選択" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 作業時間（分） */}
        <div>
          <label className="text-xs text-slate-500 mb-1 block">作業時間（分） <span className="text-red-400">*</span></label>
          <Input
            type="number"
            min={0}
            step={1}
            value={row.duration_minutes || ""}
            onChange={(e) => handleChange("duration_minutes", Number(e.target.value))}
            placeholder="例: 60"
            className="text-sm"
          />
        </div>
      </div>

      {/* 作業詳細 */}
      <div>
        <label className="text-xs text-slate-500 mb-1 block">作業詳細</label>
        <Input
          value={row.description || ""}
          onChange={(e) => handleChange("description", e.target.value)}
          placeholder="作業内容の詳細（任意）"
          className="text-sm"
        />
      </div>
    </div>
  );
}