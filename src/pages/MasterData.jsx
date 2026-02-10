import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Loader2, Building2, Tag, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import useCurrentUser from "../components/hooks/useCurrentUser";

export default function MasterData() {
  const { user, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("clients");

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-500">管理者のみアクセスできます</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">マスタ管理</h1>
        <p className="text-sm text-slate-500 mt-1">顧客・作業区分・ユーザー設定</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="clients" className="gap-1.5"><Building2 className="w-3.5 h-3.5" />顧客</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tag className="w-3.5 h-3.5" />作業区分</TabsTrigger>
          <TabsTrigger value="users" className="gap-1.5"><Users className="w-3.5 h-3.5" />ユーザー</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <ClientsTab queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="categories">
          <CategoriesTab queryClient={queryClient} />
        </TabsContent>
        <TabsContent value="users">
          <UsersTab queryClient={queryClient} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ClientsTab({ queryClient }) {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["allClients"],
    queryFn: () => base44.entities.Client.list("name"),
  });
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing({ name: "", code: "", is_active: true }); setShowDialog(true); };
  const openEdit = (c) => { setEditing({ ...c }); setShowDialog(true); };

  const save = async () => {
    if (!editing.name) { toast.error("顧客名を入力してください"); return; }
    setSaving(true);
    try {
      if (editing.id) {
        await base44.entities.Client.update(editing.id, editing);
      } else {
        await base44.entities.Client.create(editing);
      }
      queryClient.invalidateQueries({ queryKey: ["allClients"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      setShowDialog(false);
      toast.success("保存しました");
    } finally { setSaving(false); }
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800">
          <Plus className="w-3.5 h-3.5" />新規顧客
        </Button>
      </div>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto mt-8" /> : (
        <div className="space-y-1.5">
          {clients.map(c => (
            <div key={c.id} onClick={() => openEdit(c)} className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-all">
              <span className="font-medium text-slate-800">{c.name}</span>
              <Badge variant={c.is_active !== false ? "default" : "secondary"} className="text-xs">
                {c.is_active !== false ? "有効" : "無効"}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "顧客編集" : "新規顧客"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-xs">顧客名 *</Label><Input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="mt-1" /></div>
              <div><Label className="text-xs">顧客コード</Label><Input value={editing.code || ""} onChange={e => setEditing({...editing, code: e.target.value})} className="mt-1" /></div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active !== false} onCheckedChange={v => setEditing({...editing, is_active: v})} />
                <Label className="text-xs">有効</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function CategoriesTab({ queryClient }) {
  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["allCategories"],
    queryFn: () => base44.entities.WorkCategory.list("sort_order"),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => base44.entities.Department.list("sort_order"),
  });
  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing({ name: "", department_code: "", is_revision: false, is_active: true, sort_order: 99 }); setShowDialog(true); };
  const openEdit = (c) => { setEditing({ ...c }); setShowDialog(true); };

  const save = async () => {
    if (!editing.name) { toast.error("作業区分名を入力してください"); return; }
    setSaving(true);
    try {
      if (editing.id) {
        await base44.entities.WorkCategory.update(editing.id, editing);
      } else {
        await base44.entities.WorkCategory.create(editing);
      }
      queryClient.invalidateQueries({ queryKey: ["allCategories"] });
      queryClient.invalidateQueries({ queryKey: ["workCategories"] });
      setShowDialog(false);
      toast.success("保存しました");
    } finally { setSaving(false); }
  };

  const deptMap = {};
  departments.forEach(d => { deptMap[d.code] = d.name; });

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openNew} size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800">
          <Plus className="w-3.5 h-3.5" />新規作業区分
        </Button>
      </div>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto mt-8" /> : (
        <div className="space-y-1.5">
          {categories.map(c => (
            <div key={c.id} onClick={() => openEdit(c)} className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-all">
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-800">{c.name}</span>
                {c.is_revision && <Badge className="bg-orange-100 text-orange-700 text-[10px]">修正</Badge>}
              </div>
              <span className="text-xs text-slate-400">{c.department_code ? deptMap[c.department_code] || c.department_code : "共通"}</span>
            </div>
          ))}
        </div>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? "作業区分編集" : "新規作業区分"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-xs">作業区分名 *</Label><Input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} className="mt-1" /></div>
              <div>
                <Label className="text-xs">対象部署（空＝共通）</Label>
                <Select value={editing.department_code || "_common"} onValueChange={v => setEditing({...editing, department_code: v === "_common" ? "" : v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_common">共通</SelectItem>
                    {departments.map(d => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_revision} onCheckedChange={v => setEditing({...editing, is_revision: v})} />
                <Label className="text-xs">修正対応フラグ</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={editing.is_active !== false} onCheckedChange={v => setEditing({...editing, is_active: v})} />
                <Label className="text-xs">有効</Label>
              </div>
              <div><Label className="text-xs">表示順</Label><Input type="number" value={editing.sort_order || 0} onChange={e => setEditing({...editing, sort_order: parseInt(e.target.value) || 0})} className="mt-1" /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function UsersTab({ queryClient }) {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list("full_name"),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: () => base44.entities.Department.list("sort_order"),
  });
  const [showDialog, setShowDialog] = useState(false);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [inviteForm, setInviteForm] = useState({ email: "", full_name: "", department_code: "", app_role: "一般" });
  const [saving, setSaving] = useState(false);

  const openEdit = (u) => { setEditing({ ...u }); setShowDialog(true); };
  const openInvite = () => { setInviteForm({ email: "", full_name: "", department_code: "", app_role: "一般" }); setShowInviteDialog(true); };

  const save = async () => {
    setSaving(true);
    try {
      await base44.entities.User.update(editing.id, {
        department_code: editing.department_code,
        app_role: editing.app_role,
      });
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      setShowDialog(false);
      toast.success("ユーザー設定を更新しました");
    } finally { setSaving(false); }
  };

  const inviteUser = async () => {
    if (!inviteForm.email || !inviteForm.full_name) {
      toast.error("メールアドレスと氏名を入力してください");
      return;
    }
    setSaving(true);
    try {
      await base44.users.inviteUser(inviteForm.email, "user");
      // 招待後、ユーザー情報を更新
      const invitedUsers = await base44.entities.User.filter({ email: inviteForm.email });
      if (invitedUsers.length > 0) {
        await base44.entities.User.update(invitedUsers[0].id, {
          full_name: inviteForm.full_name,
          department_code: inviteForm.department_code,
          app_role: inviteForm.app_role,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["allUsers"] });
      setShowInviteDialog(false);
      toast.success(`${inviteForm.email} に招待メールを送信しました`);
    } catch (error) {
      toast.error("招待に失敗しました: " + error.message);
    } finally { setSaving(false); }
  };

  const roleColors = {
    "管理者": "bg-red-100 text-red-700",
    "副管理者": "bg-purple-100 text-purple-700",
    "営業": "bg-blue-100 text-blue-700",
    "一般": "bg-slate-100 text-slate-600",
  };

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={openInvite} size="sm" className="gap-1.5 bg-slate-900 hover:bg-slate-800">
          <Plus className="w-3.5 h-3.5" />テストユーザーを招待
        </Button>
      </div>
      {isLoading ? <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto mt-8" /> : (
        <div className="space-y-1.5">
          {users.map(u => (
            <div key={u.id} onClick={() => openEdit(u)} className="flex items-center justify-between px-4 py-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 cursor-pointer transition-all">
              <div>
                <span className="font-medium text-slate-800">{u.full_name}</span>
                <span className="text-xs text-slate-400 ml-2">{u.email}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">{u.department_code || "未設定"}</Badge>
                <Badge className={`text-xs ${roleColors[u.app_role] || roleColors["一般"]}`}>{u.app_role || "一般"}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>ユーザー設定</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div><Label className="text-xs">氏名</Label><p className="text-sm font-medium mt-1">{editing.full_name}</p></div>
              <div><Label className="text-xs">メール</Label><p className="text-sm text-slate-500 mt-1">{editing.email}</p></div>
              <div>
                <Label className="text-xs">部署</Label>
                <Select value={editing.department_code || "_none"} onValueChange={v => setEditing({...editing, department_code: v === "_none" ? "" : v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">未設定</SelectItem>
                    {departments.map(d => <SelectItem key={d.code} value={d.code}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">権限</Label>
                <Select value={editing.app_role || "一般"} onValueChange={v => setEditing({...editing, app_role: v})}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="管理者">管理者</SelectItem>
                    <SelectItem value="副管理者">副管理者</SelectItem>
                    <SelectItem value="営業">営業</SelectItem>
                    <SelectItem value="一般">一般</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={save} disabled={saving} className="bg-slate-900 hover:bg-slate-800">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}