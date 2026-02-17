import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Clock, ChevronDown, ChevronUp, Loader2, Edit, FileText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import useCurrentUser from "../components/hooks/useCurrentUser";

export default function MyLogs() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedItems, setExpandedItems] = useState([]);

  // 直近30日分の自分のWorkLogを取得
  const { data: workLogs = [], isLoading } = useQuery({
    queryKey: ["myWorkLogs", user?.email],
    queryFn: async () => {
      // list()で全件取得→JSで絞り込み（filter()のエラー回避）
      const allLogs = await base44.entities.WorkLog.list("-created_date", 5000);
      const thirtyDaysAgo = format(subDays(new Date(), 30), "yyyy-MM-dd");
      return allLogs.filter(log => 
        log.user_email === user.email && 
        log.work_date >= thirtyDaysAgo
      );
    },
    enabled: !!user?.email,
  });

  // 日付ごとにグループ化
  const groupedByDate = useMemo(() => {
    const groups = {};
    workLogs.forEach(log => {
      if (!groups[log.work_date]) {
        groups[log.work_date] = [];
      }
      groups[log.work_date].push(log);
    });

    // 日付ごとに集計とステータス判定
    return Object.entries(groups).map(([date, logs]) => {
      const totalMinutes = logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0);
      
      // ステータス判定：その日のログのいずれかが提出済なら提出済とみなす
      const hasSubmitted = logs.some(l => l.status === "提出済" || l.status === "承認済");
      const submittedLog = logs.find(l => l.submitted_at);
      
      let statusType = "未提出";
      if (hasSubmitted && submittedLog) {
        const submittedAt = new Date(submittedLog.submitted_at).getTime();
        const hasChanges = logs.some(l => {
          const updatedAt = new Date(l.updated_date).getTime();
          return updatedAt > submittedAt;
        });
        statusType = hasChanges ? "提出済（変更あり）" : "提出済（変更なし）";
      } else if (hasSubmitted) {
        statusType = "提出済（変更なし）";
      }

      return {
        date,
        logs,
        totalMinutes,
        statusType,
      };
    }).sort((a, b) => b.date.localeCompare(a.date)); // 新しい順
  }, [workLogs]);

  // フィルタ適用
  const filteredGroups = useMemo(() => {
    if (filterStatus === "all") return groupedByDate;
    return groupedByDate.filter(g => {
      if (filterStatus === "未提出") return g.statusType === "未提出";
      if (filterStatus === "提出済（変更なし）") return g.statusType === "提出済（変更なし）";
      if (filterStatus === "提出済（変更あり）") return g.statusType === "提出済（変更あり）";
      return true;
    });
  }, [groupedByDate, filterStatus]);

  const fmtTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return `${h}:${m.toString().padStart(2, '0')}`;
  };

  const handleToggleAll = (open) => {
    if (open) {
      setExpandedItems(filteredGroups.map(g => g.date));
    } else {
      setExpandedItems([]);
    }
  };

  const getStatusBadge = (statusType) => {
    if (statusType === "未提出") {
      return <Badge variant="outline" className="text-slate-500 border-slate-300">未提出</Badge>;
    }
    if (statusType === "提出済（変更なし）") {
      return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">提出済</Badge>;
    }
    if (statusType === "提出済（変更あり）") {
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200">提出済（変更あり）</Badge>;
    }
    return null;
  };

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">日報一覧</h1>
        <p className="text-sm text-slate-500 mt-1">過去30日分の作業記録</p>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6 bg-white rounded-xl border border-slate-200 p-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="提出状況" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全て</SelectItem>
            <SelectItem value="未提出">未提出</SelectItem>
            <SelectItem value="提出済（変更なし）">提出済（変更なし）</SelectItem>
            <SelectItem value="提出済（変更あり）">提出済（変更あり）</SelectItem>
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={() => handleToggleAll(true)} className="gap-1.5">
          <ChevronDown className="w-3.5 h-3.5" />
          すべて開く
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleToggleAll(false)} className="gap-1.5">
          <ChevronUp className="w-3.5 h-3.5" />
          すべて閉じる
        </Button>

        <Button 
          onClick={() => navigate(createPageUrl("DailyLog"))}
          className="ml-auto bg-slate-900 hover:bg-slate-800 gap-2"
        >
          <FileText className="w-4 h-4" />
          日報を書く
        </Button>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-400">該当する日報がありません</p>
        </div>
      ) : (
        <Accordion 
          type="multiple" 
          value={expandedItems} 
          onValueChange={setExpandedItems}
          className="space-y-3"
        >
          {filteredGroups.map((group) => (
            <AccordionItem 
              key={group.date} 
              value={group.date}
              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <AccordionTrigger className="px-5 py-4 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between w-full pr-3">
                  <div className="flex items-center gap-4">
                    <div className="text-left">
                      <p className="text-base font-semibold text-slate-900">
                        {format(parseISO(group.date), "yyyy年M月d日(E)", { locale: ja })}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {group.logs.length}件の作業記録
                      </p>
                    </div>
                    {getStatusBadge(group.statusType)}
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
                      <Clock className="w-4 h-4 text-slate-400" />
                      {fmtTime(group.totalMinutes)}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(createPageUrl("DailyLog") + "?date=" + group.date);
                      }}
                      className="gap-1.5"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      編集
                    </Button>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-5 pb-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 text-xs font-medium text-slate-500">顧客</th>
                        <th className="text-left py-2 text-xs font-medium text-slate-500">案件名</th>
                        <th className="text-left py-2 text-xs font-medium text-slate-500">作業区分</th>
                        <th className="text-left py-2 text-xs font-medium text-slate-500">作業詳細</th>
                        <th className="text-right py-2 text-xs font-medium text-slate-500">時間</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.logs.map((log, idx) => (
                        <tr key={idx} className="border-b border-slate-50">
                          <td className="py-2.5 text-slate-700">{log.client_name || "—"}</td>
                          <td className="py-2.5 text-slate-800">{log.project_name || "—"}</td>
                          <td className="py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-700">{log.work_category_name}</span>
                              {log.is_revision && (
                                <Badge variant="outline" className="text-orange-600 border-orange-300 text-[10px] px-1">修正</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-2.5 text-slate-600 max-w-md truncate">{log.description || "—"}</td>
                          <td className="py-2.5 text-right font-mono text-slate-800">{fmtTime(log.duration_minutes)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}
    </div>
  );
}