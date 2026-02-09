import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";

const statusColors = {
  "進行中": "bg-emerald-100 text-emerald-700",
  "完了": "bg-slate-100 text-slate-500",
  "保留": "bg-yellow-100 text-yellow-700",
  "仮案件": "bg-amber-100 text-amber-700",
};

export default function Projects() {
  const { user, canManageProjects } = useCurrentUser();
  const { clients, departments } = useMasterData();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("進行中");
  const [showDialog, setShowDialog] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["allProjects"],
    queryFn: () => base44.entities.Project.list("-created_date", 2000),
  });

  const filtered = projects.filter(p => {
    if (statusFilter && statusFilter !== "_all" && p.status !== statusFilter) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !(p.client_name || "").toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const emptyForm = {
    name: "",
    client_id: "",
    client_name: "",
    status: "進行中",
    description: "",
    is_temporary: false,
  };

  const openNew = () => {
    setEditingProject(emptyForm);
    setShowDialog(true);
  };

  const openEdit = (p) => {
    setEditingProject({ ...p });
    setShowDialog(true);
  };

  const save = async () => {
    if (!editingProject.name) {
      toast.error("案件名を入力してください");
      return;
    }
    setSaving(true);
    try {
      const client = clients.find(c => c.id === editingProject.client_id);
      const data = {
        ...editingProject,
        client_name: client?.name || editingProject.client_name || "",
      };

      if (editingProject.id) {
        await base44.entities.Project.update(editingProject.id, data);
        toast.success("案件を更新しました");
      } else {
        await base44.entities.Project.create(data);
        toast.success("案件を作成しました");
      }
      queryClient.invalidateQueries({ queryKey: ["allProjects"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setShowDialog(false);
    } catch (e) {
      toast.error("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">案件管理</h1>
          <p className="text-sm text-slate-500 mt-1">{filtered.length}件の案件</p>
        </div>
        {canManageProjects && (
          <Button onClick={openNew} className="gap-2 bg-slate-900 hover:bg-slate-800">
            <Plus className="w-4 h-4" />
            新規案件
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="案件名・顧客名で検索..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            <SelectItem value="進行中">進行中</SelectItem>
            <SelectItem value="完了">完了</SelectItem>
            <SelectItem value="保留">保留</SelectItem>
            <SelectItem value="仮案件">仮案件</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div
              key={p.id}
              onClick={() => canManageProjects && openEdit(p)}
              className={`flex items-center justify-between px-5 py-3.5 bg-white rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all ${canManageProjects ? "cursor-pointer" : ""}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="min-w-0">
                  <p className="font-medium text-slate-800 truncate">{p.name}</p>
                  <p className="text-xs text-slate-500">{p.client_name || "顧客未設定"}</p>
                </div>
              </div>
              <Badge className={`${statusColors[p.status] || "bg-slate-100 text-slate-500"} text-xs shrink-0`}>
                {p.status}
              </Badge>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-sm">該当する案件がありません</div>
          )}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject?.id ? "案件編集" : "新規案件"}</DialogTitle>
          </DialogHeader>
          {editingProject && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs">案件名 *</Label>
                <Input
                  value={editingProject.name}
                  onChange={e => setEditingProject({ ...editingProject, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">顧客</Label>
                <Select
                  value={editingProject.client_id || "_none"}
                  onValueChange={v => {
                    const cl = clients.find(c => c.id === v);
                    setEditingProject({
                      ...editingProject,
                      client_id: v === "_none" ? "" : v,
                      client_name: cl?.name || "",
                    });
                  }}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">— 選択なし —</SelectItem>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">ステータス</Label>
                <Select
                  value={editingProject.status}
                  onValueChange={v => setEditingProject({ ...editingProject, status: v })}
                >
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="進行中">進行中</SelectItem>
                    <SelectItem value="完了">完了</SelectItem>
                    <SelectItem value="保留">保留</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">メモ</Label>
                <Textarea
                  value={editingProject.description || ""}
                  onChange={e => setEditingProject({ ...editingProject, description: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}