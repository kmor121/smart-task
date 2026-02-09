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
import { CalendarIcon, Plus, Copy, Save, Send, Clock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import WorkLogRow from "../components/dailylog/WorkLogRow";

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
  const { user } = useCurrentUser();
  const { clients, projects, workCategories } = useMasterData();
  const queryClient = useQueryClient();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const [rows, setRows] = useState([emptyRow()]);
  const [saving, setSaving] = useState(false);

  // 既存のWorkLogsを読み込み
  const { data: existingLogs = [], isLoading } = useQuery({
    queryKey: ["workLogs", dateStr, user?.email],
    queryFn: () => base44.entities.WorkLog.filter({ work_date: dateStr, user_email: user.email }),
    enabled: !!user?.email,
  });

  // 既存ログが変わったらrowsを更新
  useEffect(() => {
    if (existingLogs.length > 0) {
      setRows(existingLogs.map(log => ({
        id: log.id,
        client_id: log.client_id || "",
        client_name: log.client_name || "",
        project_id: log.project_id || "",
        project_name: log.project_name || "",
        is_temporary_project: log.is_temporary_project || false,
        work_category_id: log.work_category_id || "",
        work_category_name: log.work_category_name || "",
        is_revision: log.is_revision || false,
        duration_minutes: log.duration_minutes || 0,
        description: log.description || "",
        status: log.status || "下書き",
      })));
    } else {
      setRows([emptyRow()]);
    }
  }, [existingLogs]);

  const handleRowChange = (index, updated) => {
    setRows(prev => prev.map((r, i) => (i === index ? updated : r)));
  };

  const addRow = () => setRows(prev => [...prev, emptyRow()]);

  const removeRow = (index) => {
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  // 前回の作業をコピー
  const copyPreviousDay = async () => {
    let checkDate = subDays(selectedDate, 1);
    // 営業日を探す（最大7日戻る）
    for (let i = 0; i < 7; i++) {
      const prevDateStr = format(checkDate, "yyyy-MM-dd");
      const prevLogs = await base44.entities.WorkLog.filter({
        work_date: prevDateStr,
        user_email: user.email,
      });
      if (prevLogs.length > 0) {
        setRows(prevLogs.map(log => ({
          client_id: log.client_id || "",
          client_name: log.client_name || "",
          project_id: log.project_id || "",
          project_name: log.project_name || "",
          is_temporary_project: log.is_temporary_project || false,
          work_category_id: log.work_category_id || "",
          work_category_name: log.work_category_name || "",
          is_revision: log.is_revision || false,
          duration_minutes: log.duration_minutes || 0,
          description: "",
        })));
        toast.success(`${format(checkDate, "M/d(E)", { locale: ja })}の作業をコピーしました`);
        return;
      }
      checkDate = subDays(checkDate, 1);
    }
    toast.error("直近7日間の作業記録が見つかりませんでした");
  };

  const saveWorkLogs = async (submitStatus) => {
    // バリデーション
    const invalid = rows.some(r => !r.project_id || !r.work_category_id || !r.duration_minutes);
    if (invalid) {
      toast.error("案件・作業区分・作業時間は必須です");
      return;
    }

    setSaving(true);
    try {
      // 既存レコードを削除
      for (const log of existingLogs) {
        await base44.entities.WorkLog.delete(log.id);
      }

      // 新規作成
      const records = rows.map(r => ({
        work_date: dateStr,
        user_email: user.email,
        user_name: user.full_name,
        department_code: user.department_code || "",
        client_id: r.client_id,
        client_name: r.client_name,
        project_id: r.project_id,
        project_name: r.project_name,
        is_temporary_project: r.is_temporary_project,
        work_category_id: r.work_category_id,
        work_category_name: r.work_category_name,
        is_revision: r.is_revision,
        duration_minutes: r.duration_minutes,
        description: r.description,
        status: submitStatus,
      }));

      await base44.entities.WorkLog.bulkCreate(records);
      queryClient.invalidateQueries({ queryKey: ["workLogs", dateStr] });
      toast.success(submitStatus === "提出済" ? "日報を提出しました" : "下書きを保存しました");
    } catch (e) {
      toast.error("保存に失敗しました: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const totalMinutes = rows.reduce((sum, r) => sum + (r.duration_minutes || 0), 0);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  const isSubmitted = existingLogs.some(l => l.status === "提出済" || l.status === "承認済");

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
                onChange={handleRowChange}
                onRemove={removeRow}
                canRemove={rows.length > 1}
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
              disabled={saving}
              className="flex-1 gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              下書き保存
            </Button>
            <Button
              onClick={() => saveWorkLogs("提出済")}
              disabled={saving}
              className="flex-1 gap-2 bg-slate-900 hover:bg-slate-800"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              提出
            </Button>
          </div>
        </>
      )}
    </div>
  );
}