import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [formData, setFormData] = useState({ project_title: "", client_id: "", client_name: "" });
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

  const { data: clientsData } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const response = await base44.functions.invoke("getClients", {});
      return response.data;
    },
    enabled: !!user,
  });

  const projects = projectsData?.projects || [];
  const clients = clientsData?.clients?.filter(c => c.is_active !== false) || [];

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('createProject', data);
      if (!response.data?.success) {
        throw new Error(response.data?.error || "案件の作成に失敗しました");
      }
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDialogOpen(false);
      setFormData({ project_title: "", client_id: "", client_name: "" });
      toast.success(`案件を作成しました`);
    },
    onError: (error) => {
      const errorMsg = error.message || "案件の作成に失敗しました";
      toast.error(`エラー: ${errorMsg}`);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.project_title || !formData.client_id) {
      toast.error("案件名と顧客は必須です");
      return;
    }
    const today = format(new Date(), "yyyy-MM-dd");
    createMutation.mutate({
      project_date: today,
      project_title: formData.project_title,
      client_id: formData.client_id,
      client_name: formData.client_name,
      status: "見込み",
    });
  };

  const filteredProjects = Array.isArray(projects) ? projects.filter(p =>
    p.project_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client_name?.toLowerCase().includes(searchTerm.toLowerCase())
  ) : [];

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
                      value={formData.project_title}
                      onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
                      placeholder="案件名を入力"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 mb-1 block">
                      顧客 <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.client_id}
                      onChange={(e) => {
                        const selected = clients.find(c => c.id === e.target.value);
                        setFormData({ ...formData, client_id: e.target.value, client_name: selected?.name || "" });
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-400"
                    >
                      <option value="">顧客を選択</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
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

      <EditProjectDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        project={editingProject}
        onSuccess={async () => {
          await refreshProjects();
          queryClient.invalidateQueries({ queryKey: ["projects"] });
        }}
      />
    </div>
  );
}