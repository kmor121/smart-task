import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, Edit2, Archive, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import useCurrentUser from "../components/hooks/useCurrentUser";

export default function AdminData() {
  const { user, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  const [clientDialog, setClientDialog] = useState(false);
  const [projectDialog, setProjectDialog] = useState(false);
  const [resetDialog, setResetDialog] = useState(false);
  
  const [editingClient, setEditingClient] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  
  const [clientForm, setClientForm] = useState({ name: "", code: "", is_active: true });
  const [projectForm, setProjectForm] = useState({ name: "", client_name: "", is_active: true });
  
  const [resetForm, setResetForm] = useState({ startDate: "", endDate: "", confirmText: "" });

  const { data: clients = [], isLoading: loadingClients } = useQuery({
    queryKey: ["clients"],
    queryFn: () => base44.entities.Client.list(),
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => base44.entities.Project.list(),
  });

  const saveClientMutation = useMutation({
    mutationFn: async (data) => {
      if (editingClient) {
        return base44.entities.Client.update(editingClient.id, data);
      } else {
        return base44.entities.Client.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["masterData"] });
      setClientDialog(false);
      setEditingClient(null);
      setClientForm({ name: "", code: "", is_active: true });
      toast.success(editingClient ? "顧客を更新しました" : "顧客を追加しました");
    },
  });

  const saveProjectMutation = useMutation({
    mutationFn: async (data) => {
      if (editingProject) {
        return base44.entities.Project.update(editingProject.id, data);
      } else {
        return base44.entities.Project.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["masterData"] });
      setProjectDialog(false);
      setEditingProject(null);
      setProjectForm({ name: "", client_name: "", is_active: true });
      toast.success(editingProject ? "案件を更新しました" : "案件を追加しました");
    },
  });

  const resetDataMutation = useMutation({
    mutationFn: async ({ startDate, endDate }) => {
      const logs = await base44.entities.WorkLog.filter({});
      const toDelete = logs.filter(log => {
        if (startDate && log.work_date < startDate) return false;
        if (endDate && log.work_date > endDate) return false;
        return true;
      });

      for (const log of toDelete) {
        await base44.entities.WorkLog.delete(log.id);
      }
      return toDelete.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ["workLogs"] });
      queryClient.invalidateQueries({ queryKey: ["myWorkLogs"] });
      queryClient.invalidateQueries({ queryKey: ["myLogsCount"] });
      queryClient.invalidateQueries({ queryKey: ["dashboardLogs"] });
      setResetDialog(false);
      setResetForm({ startDate: "", endDate: "", confirmText: "" });
      toast.success(`${count}件の日報データを削除しました`);
    },
  });

  const handleEditClient = (client) => {
    setEditingClient(client);
    setClientForm({ name: client.name, code: client.code || "", is_active: client.is_active });
    setClientDialog(true);
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setProjectForm({ name: project.name, client_name: project.client_name, is_active: project.is_active });
    setProjectDialog(true);
  };

  const handleResetData = () => {
    if (resetForm.confirmText !== "DELETE") {
      toast.error("確認のため「DELETE」と入力してください");
      return;
    }
    if (!resetForm.startDate || !resetForm.endDate) {
      toast.error("期間を指定してください");
      return;
    }
    resetDataMutation.mutate({ startDate: resetForm.startDate, endDate: resetForm.endDate });
  };

  if (!user) return null;

  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-slate-500">このページは管理者のみ閲覧できます</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">管理者機能</h1>
        <p className="text-sm text-slate-500 mt-1">顧客・案件・データ管理</p>
      </div>

      <Tabs defaultValue="clients" className="space-y-6">
        <TabsList>
          <TabsTrigger value="clients">顧客管理</TabsTrigger>
          <TabsTrigger value="projects">案件管理</TabsTrigger>
          <TabsTrigger value="reset">データリセット</TabsTrigger>
        </TabsList>

        {/* 顧客管理 */}
        <TabsContent value="clients">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">顧客一覧</CardTitle>
              <Button onClick={() => { setClientDialog(true); setEditingClient(null); setClientForm({ name: "", code: "", is_active: true }); }} className="gap-2">
                <Plus className="w-4 h-4" />
                顧客を追加
              </Button>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-2">
                  {clients.map(client => (
                    <div key={client.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{client.name}</p>
                          {client.code && <p className="text-xs text-slate-500">コード: {client.code}</p>}
                        </div>
                        {!client.is_active && <Badge variant="outline" className="text-slate-500">アーカイブ</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEditClient(client)} className="gap-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                        編集
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 案件管理 */}
        <TabsContent value="projects">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">案件一覧</CardTitle>
              <Button onClick={() => { setProjectDialog(true); setEditingProject(null); setProjectForm({ name: "", client_name: "", is_active: true }); }} className="gap-2">
                <Plus className="w-4 h-4" />
                案件を追加
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProjects ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
              ) : (
                <div className="space-y-2">
                  {projects.map(project => (
                    <div key={project.id} className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <div>
                          <p className="font-medium text-slate-800">{project.name}</p>
                          <p className="text-xs text-slate-500">顧客: {project.client_name} · ステータス: {project.status}</p>
                        </div>
                        {!project.is_active && <Badge variant="outline" className="text-slate-500">アーカイブ</Badge>}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleEditProject(project)} className="gap-1.5">
                        <Edit2 className="w-3.5 h-3.5" />
                        編集
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* データリセット */}
        <TabsContent value="reset">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                テスト用データリセット
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800 font-medium mb-2">⚠️ 注意事項</p>
                <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                  <li>指定期間内の全ユーザーの日報データを削除します</li>
                  <li>この操作は取り消せません</li>
                  <li>顧客・案件マスタは削除されません</li>
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">開始日</label>
                  <Input type="date" value={resetForm.startDate} onChange={e => setResetForm({ ...resetForm, startDate: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">終了日</label>
                  <Input type="date" value={resetForm.endDate} onChange={e => setResetForm({ ...resetForm, endDate: e.target.value })} />
                </div>
              </div>

              <Button variant="destructive" onClick={() => setResetDialog(true)} className="gap-2" disabled={!resetForm.startDate || !resetForm.endDate}>
                <Trash2 className="w-4 h-4" />
                データを削除
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 顧客編集ダイアログ */}
      <Dialog open={clientDialog} onOpenChange={setClientDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingClient ? "顧客を編集" : "顧客を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">顧客名 <span className="text-red-500">*</span></label>
              <Input value={clientForm.name} onChange={e => setClientForm({ ...clientForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">顧客コード</label>
              <Input value={clientForm.code} onChange={e => setClientForm({ ...clientForm, code: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">有効</label>
              <Switch checked={clientForm.is_active} onCheckedChange={v => setClientForm({ ...clientForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClientDialog(false)}>キャンセル</Button>
            <Button onClick={() => saveClientMutation.mutate(clientForm)} disabled={!clientForm.name}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 案件編集ダイアログ */}
      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? "案件を編集" : "案件を追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">案件名 <span className="text-red-500">*</span></label>
              <Input value={projectForm.name} onChange={e => setProjectForm({ ...projectForm, name: e.target.value })} />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">顧客名 <span className="text-red-500">*</span></label>
              <Input value={projectForm.client_name} onChange={e => setProjectForm({ ...projectForm, client_name: e.target.value })} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700">有効</label>
              <Switch checked={projectForm.is_active} onCheckedChange={v => setProjectForm({ ...projectForm, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProjectDialog(false)}>キャンセル</Button>
            <Button onClick={() => saveProjectMutation.mutate(projectForm)} disabled={!projectForm.name || !projectForm.client_name}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* データリセット確認ダイアログ */}
      <Dialog open={resetDialog} onOpenChange={setResetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600">データリセットの確認</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              {resetForm.startDate} ～ {resetForm.endDate} の期間の日報データを削除します。
            </p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium">この操作は取り消せません</p>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                確認のため「DELETE」と入力してください
              </label>
              <Input 
                value={resetForm.confirmText} 
                onChange={e => setResetForm({ ...resetForm, confirmText: e.target.value })}
                placeholder="DELETE"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetDialog(false)}>キャンセル</Button>
            <Button 
              variant="destructive" 
              onClick={handleResetData}
              disabled={resetForm.confirmText !== "DELETE" || resetDataMutation.isPending}
            >
              {resetDataMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "削除"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}