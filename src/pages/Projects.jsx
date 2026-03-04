import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search, Building2, Pencil, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import EditProjectDialog from "../components/projects/EditProjectDialog";

export default function ProjectsPage() {
  const { user, loading, isAdmin, isSales, isSubAdmin, canManageProjects } = useCurrentUser();
  const canToggle = isAdmin || isSales;
  const queryClient = useQueryClient();
  const { refreshProjects } = useMasterData();
  const [searchTerm, setSearchTerm] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [toggling, setToggling] = useState(false);

  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', user?.email],
    queryFn: async () => {
      const response = await base44.functions.invoke("getProjects", { include_inactive: true });
      return response.data;
    },
    enabled: !!user && (canToggle || isSubAdmin),
  });

  const projects = projectsData?.projects || [];

  const handleToggleActive = async (project) => {
    if (toggling) return;
    setToggling(true);
    try {
      const newActive = project.is_active === false ? true : false;
      await base44.entities.Project.update(project._id ?? project.id, { is_active: newActive });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success(newActive ? "案件を有効化しました" : "案件を無効化しました");
    } catch (e) {
      toast.error("更新に失敗しました");
    } finally {
      setToggling(false);
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
            {filteredProjects.map((project) => {
              const isInactive = project.is_active === false;
              return (
                <Card key={project.id} className={isInactive ? "opacity-50" : ""}>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <CardTitle className={`text-lg truncate ${isInactive ? "text-slate-400" : ""}`}>
                            {project.project_date} {project.project_title}
                          </CardTitle>
                          {!isInactive && (
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
                          )}
                          {canToggle && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 flex-shrink-0 ${isInactive ? "text-emerald-500 hover:text-emerald-700 hover:bg-emerald-50" : "text-slate-400 hover:text-slate-600"}`}
                              onClick={() => handleToggleActive(project)}
                              disabled={toggling}
                              title={isInactive ? "有効化" : "無効化"}
                            >
                              {isInactive ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </Button>
                          )}
                        </div>
                        <p className={`text-sm mt-1 ${isInactive ? "text-slate-400" : "text-slate-500"}`}>顧客: {project.client_name}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 text-xs text-slate-500">
                      <span>担当: {project.owner_user_name}</span>
                      <span>作成日: {new Date(project.created_date).toLocaleDateString('ja-JP')}</span>
                      {isInactive && <span className="text-slate-400 font-medium">（無効）</span>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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