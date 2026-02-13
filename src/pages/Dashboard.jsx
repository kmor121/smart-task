import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfMonth } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Wrench, FolderKanban, Loader2, TrendingUp } from "lucide-react";
import { createPageUrl } from "../utils";
import useCurrentUser from "../components/hooks/useCurrentUser";
import useMasterData from "../components/hooks/useMasterData";
import DashboardFilters from "../components/dashboard/DashboardFilters";
import ProjectTimeChart from "../components/dashboard/ProjectTimeChart";

export default function Dashboard() {
  const { user, isAdmin, isSales, isGeneral } = useCurrentUser();
  const { clients, departments } = useMasterData();

  const [filters, setFilters] = useState({
    startDate: format(startOfMonth(new Date()), "yyyy-MM-dd"),
    endDate: format(new Date(), "yyyy-MM-dd"),
    clientId: "",
    departmentCode: "",
  });

  const { data: workLogs = [], isLoading } = useQuery({
    queryKey: ["dashboardLogs", user?.email],
    queryFn: () => {
      // 管理者は全員分、非管理者は自分のみ
      if (isAdmin) {
        return base44.entities.WorkLog.list("-work_date", 5000);
      } else {
        return base44.entities.WorkLog.filter({ user_email: user.email });
      }
    },
    enabled: !!user,
  });

  // フィルタ適用
  const filteredLogs = useMemo(() => {
    return workLogs.filter(log => {
      if (filters.startDate && log.work_date < filters.startDate) return false;
      if (filters.endDate && log.work_date > filters.endDate) return false;
      if (filters.clientId && log.client_id !== filters.clientId) return false;
      
      // 部署フィルタ：department_code で絞り込み
      if (filters.departmentCode) {
        // 既存データ互換：department_code が無い場合は department_name から逆引き
        const logDeptCode = log.department_code || 
          departments.find(d => d.name === log.department_name)?.code || "";
        
        if (logDeptCode !== filters.departmentCode) return false;
      }
      
      return true;
    });
  }, [workLogs, filters, departments]);

  // 案件ごとの集計
  const projectStats = useMemo(() => {
    const map = {};
    filteredLogs.forEach(log => {
      const pid = log.project_id;
      if (!map[pid]) {
        map[pid] = {
          project_id: pid,
          project_name: log.project_name || "不明",
          client_name: log.client_name || "",
          is_temporary: log.is_temporary_project || false,
          total_minutes: 0,
          revision_minutes: 0,
          departments: new Set(),
        };
      }
      map[pid].total_minutes += log.duration_minutes || 0;
      if (log.is_revision) map[pid].revision_minutes += log.duration_minutes || 0;
      if (log.department_code) map[pid].departments.add(log.department_code);
    });

    return Object.values(map)
      .map(s => ({ ...s, departments: [...s.departments] }))
      .sort((a, b) => b.total_minutes - a.total_minutes);
  }, [filteredLogs]);

  const totalMinutes = filteredLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const revisionMinutes = filteredLogs.filter(l => l.is_revision).reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const uniqueProjects = new Set(filteredLogs.map(l => l.project_id)).size;

  const fmtTime = (min) => {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  if (!user) return null;

  // 非管理者は自分の日報へリダイレクト
  if (!isAdmin) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <h2 className="text-xl font-bold text-slate-900 mb-2">アクセス権限がありません</h2>
          <p className="text-sm text-slate-500 mb-4">このページは管理者のみ閲覧できます</p>
          <button
            onClick={() => window.location.href = createPageUrl("MyLogs")}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800"
          >
            日報一覧へ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">工数集計</h1>
        <p className="text-sm text-slate-500 mt-1">全員の工数集計</p>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <DashboardFilters
          filters={filters}
          onChange={setFilters}
          clients={clients}
          departments={departments}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">総作業時間</p>
                    <p className="text-xl font-bold text-slate-900">{fmtTime(totalMinutes)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
                    <Wrench className="w-5 h-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">修正時間</p>
                    <p className="text-xl font-bold text-slate-900">{fmtTime(revisionMinutes)}</p>
                    {totalMinutes > 0 && (
                      <p className="text-[11px] text-orange-500">
                        {((revisionMinutes / totalMinutes) * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white">
              <CardContent className="pt-5 pb-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FolderKanban className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">案件数</p>
                    <p className="text-xl font-bold text-slate-900">{uniqueProjects}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border-0 shadow-sm mb-8">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                案件別工数
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectTimeChart data={projectStats} />
            </CardContent>
          </Card>

          {/* Table */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">案件一覧</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">案件名</th>
                      <th className="text-left px-5 py-3 text-xs font-medium text-slate-500">顧客</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">総作業時間</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">修正時間</th>
                      <th className="text-right px-5 py-3 text-xs font-medium text-slate-500">修正率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectStats.map(stat => (
                      <tr key={stat.project_id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{stat.project_name}</span>
                            {stat.is_temporary && (
                              <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-[10px] px-1.5">仮</Badge>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-slate-600">{stat.client_name || "—"}</td>
                        <td className="px-5 py-3 text-right font-mono text-slate-800">{fmtTime(stat.total_minutes)}</td>
                        <td className="px-5 py-3 text-right font-mono text-orange-600">{fmtTime(stat.revision_minutes)}</td>
                        <td className="px-5 py-3 text-right">
                          {stat.total_minutes > 0 ? (
                            <span className={`text-xs font-medium ${stat.revision_minutes / stat.total_minutes > 0.3 ? "text-red-500" : "text-slate-500"}`}>
                              {((stat.revision_minutes / stat.total_minutes) * 100).toFixed(1)}%
                            </span>
                          ) : "—"}
                        </td>
                      </tr>
                    ))}
                    {projectStats.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-5 py-12 text-center text-slate-400">
                          該当するデータがありません
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}