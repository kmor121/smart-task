import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { ja } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CalendarIcon, Users, Loader2, AlertCircle, Printer,
  ChevronDown, ChevronUp
} from "lucide-react";
import useCurrentUser from "../components/hooks/useCurrentUser";
import TeamDayGroup from "../components/team/TeamDayGroup";

const DEPT_LABELS = {
  sales: "営業", design: "制作", ict: "ICT",
  print: "印刷", binding: "製本", general: "総務", manufacturing: "製造"
};

function AccessDenied() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-8 text-center">
        <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
        <h2 className="text-lg font-semibold text-slate-800 mb-2">閲覧権限がありません</h2>
        <p className="text-sm text-slate-500">このページは部長・管理者のみ閲覧できます</p>
      </div>
    </div>
  );
}

function TeamDailyLogInner({ user, isAdmin, isManager }) {
  const today = new Date();
  const [dateFrom, setDateFrom] = useState(subDays(today, 6));
  const [dateTo, setDateTo] = useState(today);

  // impersonate中の部署コードを取得
  const impersonateUserEmail = sessionStorage.getItem("impersonate_user_email");
  const impersonateUserData = impersonateUserEmail
    ? (() => { try { return JSON.parse(localStorage.getItem("impersonateUser") || "{}"); } catch { return {}; } })()
    : null;
  const effectiveDeptCode = impersonateUserData?.department_code || user?.department_code;
  const effectiveIsManager = impersonateUserData
    ? (impersonateUserData.app_role === "部長" || impersonateUserData.app_role === "副管理者")
    : isManager;

  const [departmentFilter, setDepartmentFilter] = useState(
    (effectiveIsManager && !isAdmin) ? (effectiveDeptCode || "all") : "all"
  );
  const [submitFilter, setSubmitFilter] = useState("all");
  const [allOpen, setAllOpen] = useState(true);
  const [openKey, setOpenKey] = useState(0); // force re-render of groups

  const dateFromStr = format(dateFrom, "yyyy-MM-dd");
  const dateToStr = format(dateTo, "yyyy-MM-dd");

  const { data: teamData, isLoading } = useQuery({
    queryKey: ["teamDailyLogs", dateFromStr, dateToStr, departmentFilter],
    queryFn: async () => {
      const response = await base44.functions.invoke("getTeamDailyLogs", {
        date_from: dateFromStr,
        date_to: dateToStr,
        department_code: departmentFilter === "all" ? null : departmentFilter,
      });
      return response.data;
    },
    enabled: !!user && (isAdmin || isManager),
    staleTime: 0,
  });

  // フィルタ適用（提出状況）
  const groups = useMemo(() => {
    if (!teamData?.groups) return [];
    return teamData.groups.map(group => {
      const filteredUsers = group.users.filter(u => {
        if (submitFilter === "submitted") return u.is_submitted;
        if (submitFilter === "unsubmitted") return !u.is_submitted;
        return true;
      });
      return {
        ...group,
        users: filteredUsers,
        submitted_count: filteredUsers.filter(u => u.is_submitted).length,
        unsubmitted_count: filteredUsers.filter(u => !u.is_submitted).length,
        total_minutes: filteredUsers.reduce((s, u) => s + u.total_minutes, 0),
      };
    }).filter(g => g.users.length > 0);
  }, [teamData, submitFilter]);

  const handleToggleAll = (open) => {
    setAllOpen(open);
    setOpenKey(k => k + 1);
  };

  const handlePrint = () => window.print();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6" />
            部署の日報
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {isAdmin ? "全部署の日報を確認できます" : `${DEPT_LABELS[user?.department_code] || user?.department_code}の日報を確認できます`}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} className="gap-2 print:hidden">
          <Printer className="w-4 h-4" />
          印刷
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          {/* 開始日 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 text-sm">
                <CalendarIcon className="w-4 h-4" />
                {format(dateFrom, "M月d日", { locale: ja })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateFrom} onSelect={d => d && setDateFrom(d)} locale={ja} />
            </PopoverContent>
          </Popover>

          <span className="text-slate-400 text-sm">〜</span>

          {/* 終了日 */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 text-sm">
                <CalendarIcon className="w-4 h-4" />
                {format(dateTo, "M月d日", { locale: ja })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={dateTo} onSelect={d => d && setDateTo(d)} locale={ja} />
            </PopoverContent>
          </Popover>

          {/* 提出状況 */}
          <Select value={submitFilter} onValueChange={setSubmitFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全て</SelectItem>
              <SelectItem value="submitted">提出済</SelectItem>
              <SelectItem value="unsubmitted">未提出</SelectItem>
            </SelectContent>
          </Select>

          {/* 部署（管理者のみ） */}
          {isAdmin && (
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-36">
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

          {!isAdmin && (
            <Badge variant="outline" className="text-sm px-3 py-1.5">
              {DEPT_LABELS[user?.department_code] || user?.department_code}（自部署のみ）
            </Badge>
          )}

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleToggleAll(true)} className="gap-1">
              <ChevronDown className="w-3.5 h-3.5" />
              すべて開く
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleToggleAll(false)} className="gap-1">
              <ChevronUp className="w-3.5 h-3.5" />
              すべて閉じる
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : groups.length === 0 ? (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-12 text-center">
          <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">該当する日報がありません</p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map(group => (
            <TeamDayGroup key={`${group.date}-${openKey}`} group={group} defaultOpen={allOpen} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function TeamDailyLog() {
  const { user, loading, isAdmin, isManager } = useCurrentUser();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAdmin && !isManager) return <AccessDenied />;

  return <TeamDailyLogInner user={user} isAdmin={isAdmin} isManager={isManager} />;
}