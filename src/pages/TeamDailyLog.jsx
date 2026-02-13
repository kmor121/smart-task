import React, { useState, useEffect, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CalendarIcon, Users, ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import useCurrentUser from "../components/hooks/useCurrentUser";

const DEPT_LABELS = {
  sales: "営業",
  design: "制作",
  ict: "ICT",
  print: "印刷",
  binding: "製本",
  general: "総務"
};

// アクセス拒否画面
function AccessDenied() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-red-800 mb-2">アクセス権限がありません</h2>
        <p className="text-sm text-red-600">この画面は部長または管理者のみアクセス可能です</p>
      </div>
    </div>
  );
}

// 内側コンポーネント（データ取得とUI描画）
function TeamDailyLogInner({ user, isAdmin, isManager }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [submitFilter, setSubmitFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [expandedItems, setExpandedItems] = useState([]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  // 部署の日報データを取得（キャッシュ無効化）
  const { data: teamData, isLoading, refetch } = useQuery({
    queryKey: ["teamDailyLogs", dateStr, departmentFilter],
    queryFn: async () => {
      const response = await base44.functions.invoke("getTeamDailyLogs", {
        date: dateStr,
        department_code: departmentFilter === "all" ? null : departmentFilter
      });
      console.log('📊 Team Daily Logs Response:', response.data);
      return response.data;
    },
    enabled: !!user && (isAdmin || isManager),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always'
  });

  const users = teamData?.users || [];

  // 日付・フィルタ変更時に強制再取得
  useEffect(() => {
    if (user && (isAdmin || isManager)) {
      refetch();
    }
  }, [dateStr, departmentFilter, submitFilter]);

  // フィルタリング
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (submitFilter === "submitted") return u.is_submitted;
      if (submitFilter === "unsubmitted") return !u.is_submitted;
      return true;
    });
  }, [users, submitFilter]);

  // 集計
  const stats = useMemo(() => {
    const submitted = filteredUsers.filter(u => u.is_submitted).length;
    const unsubmitted = filteredUsers.filter(u => !u.is_submitted).length;
    return { submitted, unsubmitted, total: submitted + unsubmitted };
  }, [filteredUsers]);

  // すべて開く/閉じる
  const handleExpandAll = () => {
    setExpandedItems(filteredUsers.map(u => u.user_id));
  };

  const handleCollapseAll = () => {
    setExpandedItems([]);
  };

  // 時間表示
  const formatTime = (minutes) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `${h}:00`;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <Users className="w-6 h-6" />
          部署の日報
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {isAdmin ? "部署メンバーの日報提出状況を確認できます" : "部署メンバーの日報提出状況を確認できます"}
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* 日付選択 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2">
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

          {/* 提出状況フィルタ */}
          <Select value={submitFilter} onValueChange={setSubmitFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              <SelectItem value="submitted">提出済み</SelectItem>
              <SelectItem value="unsubmitted">未提出</SelectItem>
            </SelectContent>
          </Select>

          {/* 部署フィルタ（adminのみ） */}
          {isAdmin && (
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部署</SelectItem>
                {Object.entries(DEPT_LABELS).map(([code, label]) => (
                  <SelectItem key={code} value={code}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={handleExpandAll}>
              <ChevronDown className="w-4 h-4 mr-1" />
              すべて開く
            </Button>
            <Button variant="outline" size="sm" onClick={handleCollapseAll}>
              <ChevronUp className="w-4 h-4 mr-1" />
              すべて閉じる
            </Button>
          </div>
        </div>

        {/* 集計 */}
        <div className="flex gap-4 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">対象:</span>
            <Badge variant="secondary">{stats.total}名</Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">提出済み:</span>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {stats.submitted}名
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">未提出:</span>
            <Badge className="bg-amber-100 text-amber-700 border-amber-200">
              {stats.unsubmitted}名
            </Badge>
          </div>
        </div>
        
        {/* メタ情報（デバッグ用） */}
        {teamData?._meta && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
            <p>🔍 部署: {DEPT_LABELS[teamData._meta.actual_department] || teamData._meta.actual_department || '全社'} / 
            取得ユーザー数: {teamData._meta.total_users_found}名 / 
            権限: {teamData._meta.is_admin ? '管理者' : teamData._meta.is_manager ? '部長' : '一般'}</p>
          </div>
        )}
      </div>

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-slate-50 rounded-lg p-8 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">該当するメンバーがいません</p>
        </div>
      ) : (
        <Accordion type="multiple" value={expandedItems} onValueChange={setExpandedItems}>
          <div className="space-y-3">
            {filteredUsers.map((userData) => (
              <AccordionItem key={userData.user_id} value={userData.user_id} className="border border-slate-200 rounded-lg bg-white">
                <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-slate-50 rounded-lg">
                  <div className="flex items-center gap-3 w-full">
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{userData.user_name}</span>
                        <span className="text-xs text-slate-400">
                          {DEPT_LABELS[userData.department_code] || userData.department_code}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {userData.is_submitted ? (
                        <>
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            提出済み
                          </Badge>
                          {userData.total_minutes > 0 && (
                            <Badge variant="secondary" className="font-mono">
                              {formatTime(userData.total_minutes)}
                            </Badge>
                          )}
                        </>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200">
                          未提出
                        </Badge>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-5 pb-4">
                  {userData.is_submitted && userData.entries.length > 0 ? (
                    <div className="bg-slate-50 rounded-lg p-4">
                      <h4 className="text-sm font-medium text-slate-700 mb-3">本日の進捗</h4>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-slate-200">
                              <th className="text-left py-2 px-2 text-slate-600 font-medium">顧客</th>
                              <th className="text-left py-2 px-2 text-slate-600 font-medium">案件名</th>
                              <th className="text-left py-2 px-2 text-slate-600 font-medium">作業区分</th>
                              <th className="text-left py-2 px-2 text-slate-600 font-medium">作業詳細</th>
                              <th className="text-right py-2 px-2 text-slate-600 font-medium">時間</th>
                            </tr>
                          </thead>
                          <tbody>
                            {userData.entries.map((entry, idx) => (
                              <tr key={idx} className="border-b border-slate-100 last:border-0">
                                <td className="py-2 px-2 text-slate-700">{entry.client_name || "-"}</td>
                                <td className="py-2 px-2 text-slate-700">{entry.project_name || "-"}</td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center gap-1">
                                    <span className="text-slate-700">{entry.work_category_name}</span>
                                    {entry.is_revision && (
                                      <Badge variant="outline" className="text-[10px] px-1 py-0">修正</Badge>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-2 text-slate-600 text-xs max-w-xs truncate">{entry.description || "-"}</td>
                                <td className="py-2 px-2 text-right font-mono text-slate-700">
                                  {formatTime(entry.duration_minutes)}
                                  {/* デバッグ: status表示 */}
                                  {entry.status && (
                                    <div className="text-[9px] text-slate-400 mt-0.5">{entry.status}</div>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <p className="text-slate-500">未提出です</p>
                    </div>
                  )}
                  
                  {/* デバッグ情報（提出済・未提出共通） */}
                  {userData._debug && (
                    <details className="mt-3 text-xs text-slate-400">
                      <summary className="cursor-pointer">🔍 デバッグ情報</summary>
                      <pre className="mt-1 text-left bg-slate-800 text-slate-200 p-2 rounded overflow-auto text-[10px]">
                        {JSON.stringify(userData._debug, null, 2)}
                      </pre>
                    </details>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </div>
        </Accordion>
      )}
    </div>
  );
}

// 外側コンポーネント（認証と権限チェックのみ）
export default function TeamDailyLog() {
  const { user, loading: userLoading, isAdmin, isManager } = useCurrentUser();

  // ローディング中
  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 権限チェック
  if (!isAdmin && !isManager) {
    return <AccessDenied />;
  }

  // 権限OK - 内側コンポーネントを描画
  return <TeamDailyLogInner user={user} isAdmin={isAdmin} isManager={isManager} />;
}