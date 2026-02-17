import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, subDays, isWeekend } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CalendarIcon, Plus, Copy, Save, Send, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import WorkLogRow from "../components/dailylog/WorkLogRow";
import EditProjectDialog from "../components/projects/EditProjectDialog";

const emptyRow = () => ({
  client_id: "",
  client_name: "",
  project_id: "",
  project_name: "",
  is_temporary_project: false,
  work_category_id: "",
  work_category_name: "",
  is_revision: false,
  duration_minutes: 0,
  description: "",
});

export default function DailyLog() {
  const { user, isSales, canManageProjects } = useCurrentUser();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 顧客・案件を backend function 経由で取得
  const { data: clientsData, error: clientsError, isLoading: clientsLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getClients", {});
      return response.data;
    },
    initialData: { success: true, clients: [], count: 0 },
  });

  const { data: projectsData, error: projectsError, isLoading: projectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const response = await base44.functions.invoke("getProjects", {});
      return response.data;
    },
    initialData: { success: true, projects: [], count: 0 },
  });

  const { data: workCategories = [] } = useQuery({
    queryKey: ["workCategories"],
    queryFn: () => base44.entities.WorkCategory.list(),
    initialData: [],
  });

  const clients = clientsData?.clients || [];
  const projects = projectsData?.projects || [];

  // エラー表示
  React.useEffect(() => {
    if (clientsError || !clientsData?.success) {
      toast.error(`顧客の取得に失敗しました: ${clientsData?.error || "不明なエラー"}`);
    }
    if (projectsError || !projectsData?.success) {
      toast.error(`案件の取得に失敗しました: ${projectsData?.error || "不明なエラー"}`);
    }
  }, [clientsError, projectsError, clientsData, projectsData]);
  
  const [newProjectDialogOpen, setNewProjectDialogOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ client_name: "", project_date: "", project_title: "" });
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [editProjectDialogOpen, setEditProjectDialogOpen] = useState(false);
  const [editingProjectFromRow, setEditingProjectFromRow] = useState(null);

  // URLパラメータから日付を取得
  const urlParams = new URLSearchParams(window.location.search);
  const dateParam = urlParams.get("date");
  const initialDate = dateParam ? new Date(dateParam) : new Date();
  
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedRowForNewProject, setSelectedRowForNewProject] = useState(null);
  const [lastSaveResult, setLastSaveResult] = useState(null);

  // 既存のWorkLogsを読み込み
  const { data: existingLogs = [], isLoading } = useQuery({
    queryKey: ["workLogs", dateStr, user?.email],
    queryFn: () => base44.entities.WorkLog.filter({ work_date: dateStr, user_email: user.email }),
    enabled: !!user?.email,
  });

  // データクリーンアップ（一度だけ実行）
  useEffect(() => {
    const cleanupData = async () => {
      if (!user?.email) return;
      
      try {
        const allLogs = await base44.entities.WorkLog.filter({ user_email: user.email });
        const needsCleanup = allLogs.filter(log => {
          const pid = log.project_id;
          const cid = log.client_id;
          return pid === "null" || pid === "_none" || pid === "" ||
                 cid === "null" || cid === "_none" || cid === "" ||
                 (typeof pid === "object" && pid !== null) ||
                 (typeof cid === "object" && cid !== null);
        });
        
        if (needsCleanup.length > 0) {
          console.log("Cleaning up", needsCleanup.length, "WorkLog records");
          for (const log of needsCleanup) {
            const cleanProject = typeof log.project_id === "object" ? log.project_id?.id : log.project_id;
            const cleanClient = typeof log.client_id === "object" ? log.client_id?.id : log.client_id;
            
            await base44.entities.WorkLog.update(log.id, {
              project_id: (cleanProject && cleanProject !== "null" && cleanProject !== "_none") ? cleanProject : null,
              client_id: (cleanClient && cleanClient !== "null" && cleanClient !== "_none") ? cleanClient : null,
            });
          }
          queryClient.invalidateQueries({ queryKey: ["workLogs"] });
        }
      } catch (error) {
        console.error("Cleanup failed:", error);
      }
    };
    
    cleanupData();
  }, [user?.email]);

  // 既存ログが変わったらrowsを更新（正規化処理を追加）
  useEffect(() => {
    if (existingLogs.length > 0) {
      setRows(existingLogs.map(log => {
        // project_id と client_id を正規化（""に統一）
        const normalizeId = (id) => {
          if (!id) return "";
          if (typeof id === "object") return id.id ? String(id.id) : "";
          if (id === "null" || id === "_none" || id === "") return "";
          return String(id);
        };
        
        return {
          id: log.id,
          client_id: normalizeId(log.client_id),
          client_name: log.client_name || "",
          project_id: normalizeId(log.project_id),
          project_name: log.project_name || "",
          is_temporary_project: log.is_temporary_project || false,
          work_category_id: log.work_category_id || "",
          work_category_name: log.work_category_name || "",
          is_revision: log.is_revision || false,
          duration_minutes: log.duration_minutes || 0,
          description: log.description || "",
          status: log.status || "下書き",
        };
      }));
    } else {
      setRows([emptyRow()]);
    }
  }, [existingLogs]);

  const handleRowChange = (index, updated) => {
    setRows(prev => prev.map((r, i) => (i === index ? updated : r)));
    setHasLocalChanges(true);
  };

  const addRow = () => {
    setRows(prev => [...prev, emptyRow()]);
    setHasLocalChanges(true);
  };

  const removeRow = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index));
    setHasLocalChanges(true);
  };

  // 新規案件作成（顧客未選択でも可能）
  const handleCreateNewProject = async (rowIndex) => {
    setSelectedRowForNewProject(rowIndex);
    // 該当行に顧客が既に選択されていればプリセット
    const currentRow = rows[rowIndex];
    const presetClient = currentRow?.client_id ? 
      clients.find(c => c.id === currentRow.client_id)?.name || "" : "";
    
    setNewProjectForm({ client_name: presetClient, project_date: dateStr, project_title: "" });
    setNewProjectDialogOpen(true);
  };

  const saveNewProject = async () => {
    if (!newProjectForm.project_date) {
      toast.error("日付を選択してください");
      return;
    }
    if (!newProjectForm.client_name || !newProjectForm.project_title) {
      toast.error("顧客名と案件名は必須です");
      return;
    }

    if (selectedRowForNewProject === null) return;

    setSaving(true);
    try {
      // 同名顧客をチェック
      let clientId;
      let clientName = newProjectForm.client_name.trim();
      const existingClient = clients.find(c => c.name === clientName);
      
      if (existingClient) {
        clientId = existingClient.id;
      } else {
        // 顧客を新規作成
        const newClient = await base44.entities.Client.create({
          name: clientName,
          is_active: true
        });
        clientId = newClient.id;
      }

      // 案件を作成
      const response = await base44.functions.invoke('createProject', {
        project_date: newProjectForm.project_date,
        project_title: newProjectForm.project_title.trim(),
        client_id: clientId,
        status: "仮案件"
      });

      if (response.data?.success && response.data?.project) {
        const newProject = response.data.project;
        
        // マスタデータを再取得して完了を待つ
        await queryClient.invalidateQueries({ queryKey: ['projects'] });
        await queryClient.invalidateQueries({ queryKey: ['clients'] });
        await queryClient.refetchQueries({ queryKey: ['projects'] });
        
        console.log('✅ Created project:', newProject);
        
        // 該当行に自動選択（文字列IDで統一）
        handleRowChange(selectedRowForNewProject, {
          ...rows[selectedRowForNewProject],
          client_id: String(clientId),
          client_name: clientName,
          project_id: String(newProject.id),
          project_name: newProject.name,
          is_temporary_project: true
        });

        toast.success(`案件「${newProject.name}」を作成しました`);
        setNewProjectDialogOpen(false);
        setNewProjectForm({ client_name: "", project_date: "", project_title: "" });
        setSelectedRowForNewProject(null);
      } else {
        const errorMsg = response.data?.error || "案件の作成に失敗しました";
        console.error('❌ Project creation failed:', response.data);
        throw new Error(errorMsg);
      }
    } catch (error) {
      console.error("❌ Failed to create project:", error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || "作成できませんでした";
      toast.error(`案件作成エラー: ${errorMsg}`);
    } finally {
      setSaving(false);
    }
  };

  const refreshProjects = async () => {
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    await queryClient.refetchQueries({ queryKey: ['projects'] });
  };

  const copyPreviousDay = async () => {
    try {
      // 前日の日付を取得
      const previousDate = subDays(selectedDate, 1);
      const previousDateStr = format(previousDate, "yyyy-MM-dd");

      // 前日の日報を取得
      const prevLogs = await base44.entities.WorkLog.filter({
        user_email: user.email,
        work_date: previousDateStr
      });

      if (prevLogs.length === 0) {
        return;
      }

      const latestLog = prevLogs[0];

      // Project と WorkCategory の is_active をチェック
      const project = projects.find(p => p.id === latestLog.project_id);
      const category = workCategories.find(c => c.id === latestLog.work_category_id);

      // 最初の行に work_category_id と project_id をセット
      if (rows.length > 0) {
        const updated = { ...rows[0] };

        if (project?.is_active !== false) {
          updated.client_id = String(latestLog.client_id || "");
          updated.client_name = latestLog.client_name || "";
          updated.project_id = String(latestLog.project_id || "");
          updated.project_name = latestLog.project_name || "";
          updated.is_temporary_project = latestLog.is_temporary_project || false;
        }

        if (category?.is_active !== false) {
          updated.work_category_id = latestLog.work_category_id || "";
          updated.work_category_name = latestLog.work_category_name || "";
          updated.is_revision = latestLog.is_revision || false;
        }

        handleRowChange(0, updated);
        setHasLocalChanges(true);
        toast.success("前日の作業をコピーしました");
      }
    } catch (error) {
      console.error("Failed to copy previous log:", error);
    }
  };

  const saveWorkLogs = async (submitStatus) => {
    // バリデーション（部署別）
    let invalid = false;
    let errorMessage = "";
    
    if (isSales) {
      // 営業部：顧客・案件・作業区分・作業時間が必須
      invalid = rows.some(r => !r.client_id || !r.project_id || !r.work_category_id || !r.duration_minutes);
      errorMessage = "顧客・案件・作業区分・作業時間は必須です";
    } else {
      // その他の部署：作業区分・作業時間が必須（顧客・案件は任意）
      invalid = rows.some(r => !r.work_category_id || !r.duration_minutes);
      errorMessage = "作業区分・作業時間は必須です";
    }
    
    if (invalid) {
      toast.error(errorMessage);
      return;
    }

    const isSubmit = submitStatus === "提出済";

    if (isSubmit) {
      setSubmitting(true);
    } else {
      setSaving(true);
    }

    try {
      // impersonate_user_email を取得（sessionStorage優先、なければuser.email）
      const impersonateUserEmail = sessionStorage.getItem("impersonate_user_email") || user.email;

      // 提出時は submitted_at を付与
      const rowsToSave = rows
        .filter(r => r.work_category_id && r.duration_minutes)
        .map(r => ({
          ...r,
          status: submitStatus,
          submitted_at: submitStatus === "提出済" ? new Date().toISOString() : null
        }));

      const response = await base44.functions.invoke("saveDailyLog", {
        work_date: dateStr,
        rows: rowsToSave,
        impersonate_user_email: impersonateUserEmail
      });

      const result = response.data;
      setLastSaveResult(result);

      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["workLogs"] });
        queryClient.invalidateQueries({ queryKey: ["myLogsCount"] });
        queryClient.invalidateQueries({ queryKey: ["teamDailyLogs"] });

        if (isSubmit) {
          setShowSuccessModal(true);
        } else {
          toast.success(`下書きを保存しました（${result.saved_count}件）`);
        }
      } else {
        const errorMsg = result.error || "不明なエラー";
        toast.error(isSubmit ? `提出に失敗しました: ${errorMsg}` : `保存に失敗しました: ${errorMsg}`);
      }
    } catch (e) {
      console.error("Save/Submit error:", e);
      const errorMsg = e.message || "不明なエラー";
      toast.error(isSubmit ? `提出できませんでした: ${errorMsg}` : `保存に失敗しました: ${errorMsg}`);
      setLastSaveResult({ success: false, error: errorMsg });
    } finally {
      if (isSubmit) {
        setSubmitting(false);
      } else {
        setSaving(false);
      }
    }
  };

  const totalMinutes = rows.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const isSubmitted = existingLogs.some(l => l.status === "提出済" || l.status === "承認済");
  
  // 提出/再提出判定
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  useEffect(() => {
    if (existingLogs.length > 0) {
      setHasLocalChanges(false);
    }
  }, [existingLogs]);
  
  useEffect(() => {
    if (existingLogs.length > 0) {
      setHasLocalChanges(true);
    }
  }, [rows]);
  
  const isResubmit = isSubmitted && hasLocalChanges;

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">日報入力</h1>
        <p className="text-sm text-slate-500 mt-1">作業内容を記録してください</p>
      </div>

      {/* Date picker & summary */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2 font-medium">
              <CalendarIcon className="w-4 h-4" />
              {format(selectedDate, "yyyy年M月d日(E)", { locale: ja })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={ja}
            />
          </PopoverContent>
        </Popover>

        <Badge variant="secondary" className="flex items-center gap-1.5 px-3 py-1.5">
          <Clock className="w-3.5 h-3.5" />
          合計 {hours}時間{mins > 0 ? `${mins}分` : ""}
        </Badge>

        {isSubmitted && (
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">提出済</Badge>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Work log rows */}
          <div className="space-y-3 mb-4">
            {rows.map((row, index) => (
              <WorkLogRow
                key={index}
                row={row}
                index={index}
                clients={clients}
                projects={projects}
                workCategories={workCategories}
                userDepartmentCode={user.department_code || ""}
                isSales={isSales}
                onChange={handleRowChange}
                onRemove={removeRow}
                onCreateNewProject={() => handleCreateNewProject(index)}
                canRemove={rows.length > 1}
                canManageProjects={canManageProjects}
                onEditProject={(projectId) => {
                  const project = projects.find(p => p.id === projectId);
                  if (project) {
                    setEditingProjectFromRow(project);
                    setEditProjectDialogOpen(true);
                  }
                }}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-2 mb-8">
            <Button variant="outline" size="sm" onClick={addRow} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              作業を追加する
            </Button>
            <Button variant="outline" size="sm" onClick={copyPreviousDay} className="gap-1.5">
              <Copy className="w-3.5 h-3.5" />
              前回の作業をコピー
            </Button>
          </div>

          {/* Save / Submit */}
          <div className="flex gap-3 sticky bottom-4 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-slate-200 shadow-lg">
            <Button
              variant="outline"
              onClick={() => saveWorkLogs("下書き")}
              disabled={saving || submitting}
              className="flex-1 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              下書き保存
            </Button>
            <Button
              onClick={() => saveWorkLogs("提出済")}
              disabled={
                saving || 
                submitting || 
                (isSubmitted && !hasLocalChanges) ||
                rows.some(r => {
                  if (isSales) {
                    return !r.client_id || !r.project_id || !r.work_category_id || !r.duration_minutes;
                  }
                  return !r.work_category_id || !r.duration_minutes;
                })
              }
              className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isSubmitted && !hasLocalChanges ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? "提出中…" : isSubmitted && !hasLocalChanges ? "提出済" : isResubmit ? "再提出" : "提出"}
            </Button>
          </div>

          {/* Debug Info */}
          {lastSaveResult && (
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div className="font-semibold text-slate-700 mb-1">📊 保存結果:</div>
              <div className="space-y-0.5 text-slate-600 font-mono">
                <div>success: {lastSaveResult.success ? "✅" : "❌"}</div>
                {lastSaveResult.saved_count !== undefined && (
                  <div>saved_count: {lastSaveResult.saved_count}</div>
                )}
                {lastSaveResult.error && (
                  <div className="text-red-600">error: {lastSaveResult.error}</div>
                )}
                {lastSaveResult._debug && (
                  <>
                    <div>work_date: {lastSaveResult._debug.work_date}</div>
                    <div>user_email: {lastSaveResult._debug.user_email}</div>
                    <div>department_code: {lastSaveResult._debug.department_code}</div>
                    {lastSaveResult._debug.is_impersonated && (
                      <div className="text-purple-600">
                        impersonate_user_email: {lastSaveResult._debug.impersonate_user_email}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Master Data Info */}
          <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs">
            <div className="font-semibold text-blue-800 mb-1">📦 マスタデータ:</div>
            <div className="space-y-0.5 text-blue-700 font-mono">
              <div>clients_count: {clients.length} {clientsLoading && "⏳"} {(clientsError || !clientsData?.success) && "❌"}</div>
              <div>projects_count: {projects.length} {projectsLoading && "⏳"} {(projectsError || !projectsData?.success) && "❌"}</div>
              <div>work_categories_count: {workCategories.length}</div>
              
              {/* 選択中の値をデバッグ表示 */}
              {rows.length > 0 && rows[0].client_id && (
                <div className="mt-2 pt-2 border-t border-blue-200">
                  <div className="text-green-600">✅ 選択中:</div>
                  <div>client_id: {rows[0].client_id}</div>
                  <div>client_name: {rows[0].client_name}</div>
                  {rows[0].project_id && (
                    <>
                      <div>project_id: {rows[0].project_id}</div>
                      <div>project_name: {rows[0].project_name}</div>
                    </>
                  )}
                </div>
              )}
              
              {clientsData?._debug && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">🔍 Clients Debug</summary>
                  <div className="ml-2 mt-1 space-y-0.5">
                    <div>total: {clientsData._debug.total_count}</div>
                    <div>active: {clientsData._debug.active_count}</div>
                    {clientsData._debug.sample && (
                      <div className="text-green-600">sample: {clientsData._debug.sample.name}</div>
                    )}
                  </div>
                </details>
              )}
              
              {projectsData?._debug && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-blue-600">🔍 Projects Debug</summary>
                  <div className="ml-2 mt-1 space-y-0.5">
                    <div>total: {projectsData._debug.total_count}</div>
                    <div>active: {projectsData._debug.active_count}</div>
                    <div>filtered: {projectsData._debug.filtered_count}</div>
                    {projectsData._debug.sample && (
                      <div className="text-green-600">sample: {projectsData._debug.sample.name}</div>
                    )}
                  </div>
                </details>
              )}
              
              {(clientsError || !clientsData?.success) && (
                <div className="text-red-600 mt-1">
                  <div>clients_error: {clientsData?.error || "不明"}</div>
                  {clientsData?._debug?.error_type && (
                    <div>error_type: {clientsData._debug.error_type}</div>
                  )}
                </div>
              )}
              {(projectsError || !projectsData?.success) && (
                <div className="text-red-600 mt-1">
                  <div>projects_error: {projectsData?.error || "不明"}</div>
                  {projectsData?._debug?.error_type && (
                    <div>error_type: {projectsData._debug.error_type}</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 新規案件作成モーダル */}
      <Dialog open={newProjectDialogOpen} onOpenChange={setNewProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新規案件作成</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                日付 <span className="text-red-500">*</span>
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newProjectForm.project_date ? format(new Date(newProjectForm.project_date), "yyyy年M月d日(E)", { locale: ja }) : "日付を選択"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newProjectForm.project_date ? new Date(newProjectForm.project_date) : undefined}
                    onSelect={(date) => setNewProjectForm({ ...newProjectForm, project_date: date ? format(date, "yyyy-MM-dd") : "" })}
                    locale={ja}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                顧客名 <span className="text-red-500">*</span>
              </label>
              <Input
                value={newProjectForm.client_name}
                onChange={(e) => setNewProjectForm({ ...newProjectForm, client_name: e.target.value })}
                placeholder="顧客名を入力"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                案件名 <span className="text-red-500">*</span>
              </label>
              <Input
                value={newProjectForm.project_title}
                onChange={(e) => setNewProjectForm({ ...newProjectForm, project_title: e.target.value })}
                placeholder="案件名を入力"
              />
            </div>
            {newProjectForm.project_date && newProjectForm.project_title && (
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-1">表示名プレビュー</p>
                <p className="text-sm font-medium text-slate-800">{newProjectForm.project_date}　{newProjectForm.project_title}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setNewProjectDialogOpen(false);
                  setNewProjectForm({ client_name: "", project_date: "", project_title: "" });
                  setSelectedRowForNewProject(null);
                }}
                disabled={saving}
              >
                キャンセル
              </Button>
              <Button onClick={saveNewProject} disabled={saving}>
                {saving ? "作成中..." : "作成"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 案件名編集モーダル */}
      <EditProjectDialog
        open={editProjectDialogOpen}
        onOpenChange={setEditProjectDialogOpen}
        project={editingProjectFromRow}
        onSuccess={async () => {
          // 案件一覧を再取得して即座に反映
          await refreshProjects();
          
          // 選択中の案件IDを維持したまま、名前だけ更新
          const updatedProject = projects.find(p => p.id === editingProjectFromRow?.id);
          if (updatedProject) {
            console.log('✅ Project name updated in dropdown:', updatedProject.name);
          }
        }}
      />

      {/* 提出完了モーダル */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">日報を提出しました！</h2>
            <div className="flex flex-col w-full gap-2 pt-2">
              <Button
                onClick={() => setShowSuccessModal(false)}
                variant="outline"
                className="w-full"
              >
                編集を続ける
              </Button>
              <Button
                onClick={() => navigate(createPageUrl("MyLogs"))}
                className="w-full bg-slate-900 hover:bg-slate-800"
              >
                日報一覧を見る
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}