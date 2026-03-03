import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Building2, Pencil, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', user?.email],
    queryFn: async () => {
      const response = await base44.functions.invoke("getProjects", {});
      return response.data;
    },
    enabled: !!user && canView,
  });

  const projects = projectsData?.projects || [];
  const canDelete = isSalesUser || isAdmin;

  const handleDelete = async () => {
    if (!deletingProject) return;
    setDeleting(true);
    try {
      await base44.entities.Project.delete(deletingProject._id ?? deletingProject.id);
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success("案件を削除しました");
      setDeleteDialogOpen(false);
      setDeletingProject(null);
    } catch (e) {
      toast.error("削除に失敗しました");
    } finally {
      setDeleting(false);
    }
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
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">案件管理</h1>
          <p className="text-sm text-slate-500 mt-1">営業案件の一覧と管理</p>
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