import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeftRight, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import useCurrentUser from "../components/hooks/useCurrentUser";

export default function Reassign() {
  const { user, canReassign } = useCurrentUser();
  const queryClient = useQueryClient();

  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [showDialog, setShowDialog] = useState(false);
  const [targetProjectId, setTargetProjectId] = useState("");
  const [reassigning, setReassigning] = useState(false);

  // 仮案件のWorkLogsを取得
  const { data: tempLogs = [], isLoading } = useQuery({
    queryKey: ["tempWorkLogs"],
    queryFn: async () => {
      const logs = await base44.entities.WorkLog.filter({ is_temporary_project: true });
      return logs.sort((a, b) => b.work_date.localeCompare(a.work_date));
    },
  });

  // 正式案件のリスト（仮案件を除外）
  const { data: projects = [] } = useQuery({
    queryKey: ["realProjects"],
    queryFn: async () => {
      const all = await base44.entities.Project.list("name");
      return all.filter(p => !p.is_temporary);
    },
  });

  const toggleLog = (id) => {
    setSelectedLogs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedLogs.size === tempLogs.length) {
      setSelectedLogs(new Set());
    } else {
      setSelectedLogs(new Set(tempLogs.map(l => l.id)));
    }
  };

  const openReassign = () => {
    if (selectedLogs.size === 0) {
      toast.error("付け替えるログを選択してください");
      return;
    }
    setTargetProjectId("");
    setShowDialog(true);
  };

  const doReassign = async () => {
    if (!targetProjectId) {
      toast.error("付替先の案件を選択してください");
      return;
    }
    const project = projects.find(p => p.id === targetProjectId);
    if (!project) return;

    setReassigning(true);
    try {
      const logIds = [...selectedLogs];
      for (const id of logIds) {
        await base44.entities.WorkLog.update(id, {
          project_id: project.id,
          project_name: project.name,
          is_temporary_project: false,
          client_id: project.client_id || "",
          client_name: project.client_name || "",
        });
      }
      toast.success(`${logIds.length}件のログを「${project.name}」に付け替えました`);
      setSelectedLogs(new Set());
      setShowDialog(false);
      queryClient.invalidateQueries({ queryKey: ["tempWorkLogs"] });
    } catch (e) {
      toast.error("付け替えに失敗しました: " + e.message);
    } finally {
      setReassigning(false);
    }
  };

  if (!user || !canReassign) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-slate-500">このページへのアクセス権限がありません</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">仮案件の付け替え</h1>
          <p className="text-sm text-slate-500 mt-1">
            仮案件で入力された作業ログを正式案件に付け替えます
          </p>
        </div>
        <Button
          onClick={openReassign}
          disabled={selectedLogs.size === 0}
          className="gap-2 bg-slate-900 hover:bg-slate-800"
        >
          <ArrowLeftRight className="w-4 h-4" />
          付け替え ({selectedLogs.size})
        </Button>
      </div>

      {/* Warning */}
      {tempLogs.length > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 mb-6">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700">
            <strong>{tempLogs.length}件</strong>の仮案件ログがあります。正式案件への付け替えを行ってください。
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : tempLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-300 mb-3" />
          <p className="text-lg font-medium text-slate-700">すべて付け替え済み</p>
          <p className="text-sm text-slate-400 mt-1">仮案件のログはありません</p>
        </div>
      ) : (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={selectedLogs.size === tempLogs.length && tempLogs.length > 0}
                        onCheckedChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">日付</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">作業者</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">部署</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">作業区分</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-slate-500">時間</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-slate-500">詳細</th>
                  </tr>
                </thead>
                <tbody>
                  {tempLogs.map(log => (
                    <tr
                      key={log.id}
                      className={`border-b border-slate-50 cursor-pointer transition-colors ${
                        selectedLogs.has(log.id) ? "bg-blue-50" : "hover:bg-slate-50/50"
                      }`}
                      onClick={() => toggleLog(log.id)}
                    >
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={selectedLogs.has(log.id)}
                          onCheckedChange={() => toggleLog(log.id)}
                        />
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium">{log.work_date}</td>
                      <td className="px-4 py-3 text-slate-600">{log.user_name}</td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="text-xs">{log.department_code}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{log.work_category_name}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-800">{log.duration_minutes}分</td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{log.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reassign Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>案件の付け替え</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              選択した<strong>{selectedLogs.size}件</strong>のログを以下の案件に付け替えます
            </p>
            <Select value={targetProjectId || "_none"} onValueChange={v => setTargetProjectId(v === "_none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="付替先の案件を選択" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— 選択してください —</SelectItem>
                {projects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} {p.client_name ? `(${p.client_name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>キャンセル</Button>
            <Button onClick={doReassign} disabled={reassigning || !targetProjectId} className="bg-slate-900 hover:bg-slate-800">
              {reassigning ? <Loader2 className="w-4 h-4 animate-spin" /> : "付け替え実行"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}