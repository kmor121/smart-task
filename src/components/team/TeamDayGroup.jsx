import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, CheckCircle2 } from "lucide-react";

const DEPT_LABELS = {
  sales: "営業", design: "制作", ict: "ICT",
  print: "印刷", binding: "製本", general: "総務", manufacturing: "製造"
};

function formatTime(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${m.toString().padStart(2, "0")}`;
}

export default function TeamDayGroup({ group, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);

  const dateLabel = (() => {
    try { return format(parseISO(group.date), "yyyy年M月d日(E)", { locale: ja }); }
    catch { return group.date; }
  })();

  return (
    <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
      {/* Date header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
      >
        {open ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
        <span className="font-semibold text-slate-800 flex-1">{dateLabel}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">
            提出済 {group.submitted_count}名
          </Badge>
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">
            未提出 {group.unsubmitted_count}名
          </Badge>
          {group.total_minutes > 0 && (
            <Badge variant="secondary" className="font-mono text-xs">
              合計 {formatTime(group.total_minutes)}
            </Badge>
          )}
        </div>
      </button>

      {/* Table */}
      {open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/50">
                <th className="text-left py-2.5 px-4 text-slate-500 font-medium w-28">氏名</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-medium w-24">顧客</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-medium">案件</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-medium w-32">作業区分</th>
                <th className="text-left py-2.5 px-3 text-slate-500 font-medium">作業詳細</th>
                <th className="text-right py-2.5 px-4 text-slate-500 font-medium w-20">時間</th>
              </tr>
            </thead>
            <tbody>
              {group.users.map((userData) => {
                if (!userData.is_submitted || userData.entries.length === 0) {
                  return (
                    <tr key={userData.user_email} className="border-b border-slate-100 last:border-0 bg-amber-50/30">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-700">{userData.user_name}</div>
                        <div className="text-[11px] text-slate-400">{DEPT_LABELS[userData.department_code] || userData.department_code}</div>
                      </td>
                      <td colSpan={4} className="py-3 px-3 text-slate-400 text-xs italic">未提出</td>
                      <td className="py-3 px-4" />
                    </tr>
                  );
                }

                return userData.entries.map((entry, idx) => (
                  <tr key={`${userData.user_email}-${idx}`} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    {idx === 0 ? (
                      <td className="py-2.5 px-4 align-top" rowSpan={userData.entries.length}>
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <div className="font-medium text-slate-800">{userData.user_name}</div>
                            <div className="text-[11px] text-slate-400">{DEPT_LABELS[userData.department_code] || userData.department_code}</div>
                          </div>
                        </div>
                      </td>
                    ) : null}
                    <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">{entry.client_name || "-"}</td>
                    <td className="py-2.5 px-3 text-slate-700 max-w-[180px] truncate">{entry.project_name || "-"}</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-700">{entry.work_category_name}</span>
                        {entry.is_revision && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">修正</Badge>
                        )}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-500 text-xs max-w-[200px] truncate">{entry.description || "-"}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-700 whitespace-nowrap">{formatTime(entry.duration_minutes)}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}