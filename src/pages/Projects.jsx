import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Building2, Pencil } from "lucide-react";
import { toast } from "sonner";
import EditProjectDialog from "../components/projects/EditProjectDialog";

export default function ProjectsPage() {
  const { user, loading } = useCurrentUser();

  const isSalesUser = user?.department_code === 'sales';
  const isAdmin = user?.role === 'admin' || user?.isAdmin === true;
  const canView = isSalesUser || isAdmin;
  const queryClient = useQueryClient();
  const { refreshProjects } = useMasterData();
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: "", client_name: "", status: "見込み" });
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', user?.email],
    queryFn: async () => {
      const response = await base44.functions.invoke("getProjects", {});
      return response.data;
    },
    enabled: !!user && canView,
  });

  const projects = projectsData?.projects || [];

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('createProject', data);
      console.log('Project creation response:', response.data);
      if (!response.data?.success) {
        throw new Error(response.data?.error || "案件の作成に失敗しました");
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      setDialogOpen(false);
      setFormData({ name: "", client_name: "", status: "見込み" });
      console.log('✅ Project created:', data.project);
      toast.success(`案件「${data.project.name}」を作成しました`);
    },
    onError: (error) => {
      console.error('❌ Project creation error:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.details || error.message || "案件の作成に失敗しました";
      toast.error(`エラー: ${errorMsg}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name || !formData.client_name) {
      toast.error("案件名と顧客名は必須です");
      return;
    }
    createMutation.mutate(formData);
  };

  const filteredProjects = Array.isArray(projects) ? projects.filter(p => 
    p.project_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

  const statusColors = {
    "見込み": "bg-slate-100 text-slate-700",
    "進行中": "bg-blue-100 text-blue-700",
    "受注": "bg-green-100 text-green-700",
    "失注": "bg-red-100 text-red-700",
    "完了": "bg-gray-100 text-gray-700",
    "仮案件": "bg-amber-100 text-amber-700"
  };

  if (loading || projectsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">案件管理</h1>
            <p className="text-sm text-slate-500 mt-1">営業案件の一覧と管理</p>
          </div>
          {canView && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4 mr-2" />
                  新規案件
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>新規案件作成</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      案件名 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="案件名を入力"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      顧客名 <span className="text-red-500">*</span>
                    </label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="顧客名を入力"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      ステータス
                    </label>
                    <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="見込み">見込み</SelectItem>
                        <SelectItem value="進行中">進行中</SelectItem>
                        <SelectItem value="受注">受注</SelectItem>
                        <SelectItem value="失注">失注</SelectItem>
                        <SelectItem value="完了">完了</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      キャンセル
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending ? "作成中..." : "作成"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="案件名・顧客名で検索..."
              className="pl-10"
            />
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-slate-500">案件がありません</p>
              {canView && (
                <p className="text-sm text-slate-400 mt-1">「＋新規案件」から作成してください</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredProjects.map((project) => (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg truncate">
                          {project.project_date} {project.project_title}
                        </CardTitle>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0"
                          onClick={() => {
                            setEditingProject(project);
                            setEditDialogOpen(true);
                          }}
                        >
                          <Pencil className="w-3.5 h-3.5 text-slate-500" />
                        </Button>
                      </div>
                      <p className="text-sm text-slate-500 mt-1">顧客: {project.client_name}</p>
                    </div>
                    <Badge className={statusColors[project.status] || statusColors["見込み"]}>
                      {project.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span>担当: {project.owner_user_name}</span>
                    <span>作成日: {new Date(project.created_date).toLocaleDateString('ja-JP')}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 案件名編集モーダル */}
      <EditProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={editingProject}
        onSuccess={async () => {
          // 案件一覧を即座に再取得
          await refreshProjects();
          queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
    </div>
  );
}