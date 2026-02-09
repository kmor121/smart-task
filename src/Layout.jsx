import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "./utils";
import useCurrentUser from "./components/hooks/useCurrentUser";
import {
  ClipboardList,
  BarChart3,
  FolderKanban,
  Users,
  Settings,
  ArrowLeftRight,
  Menu,
  X,
  LogOut,
  ChevronRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";

export default function Layout({ children, currentPageName }) {
  const { user, loading, isAdmin, isSubAdmin, canManageProjects, canReassign } = useCurrentUser();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin" />
          <span className="text-sm text-slate-500">読み込み中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-semibold text-slate-800">ログインが必要です</h2>
          <Button onClick={() => base44.auth.redirectToLogin()}>ログイン</Button>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: "日報入力", page: "DailyLog", icon: ClipboardList, show: true },
    { name: "ダッシュボード", page: "Dashboard", icon: BarChart3, show: true },
    { name: "案件管理", page: "Projects", icon: FolderKanban, show: canManageProjects },
    { name: "仮案件付替", page: "Reassign", icon: ArrowLeftRight, show: canReassign },
    { name: "マスタ管理", page: "MasterData", icon: Settings, show: isAdmin },
  ];

  const deptLabel = user.department_code || "未設定";
  const roleLabel = user.app_role || "一般";

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <style>{`
        :root {
          --color-primary: #1e293b;
          --color-accent: #3b82f6;
        }
      `}</style>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-white border-r border-slate-200 z-50
        transform transition-transform duration-200 ease-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        <div className="flex flex-col h-full">
          {/* Logo area */}
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight">工数管理</h1>
                <p className="text-[11px] text-slate-400 mt-0.5">Worklog Manager</p>
              </div>
              <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}>
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.filter(i => i.show).map(item => {
              const active = currentPageName === item.page;
              return (
                <Link
                  key={item.page}
                  to={createPageUrl(item.page)}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                    ${active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }
                  `}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.name}
                  {active && <ChevronRight className="w-3 h-3 ml-auto opacity-50" />}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="px-4 py-4 border-t border-slate-100">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                {(user.full_name || "?")[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{user.full_name}</p>
                <p className="text-[11px] text-slate-400">{roleLabel} · {deptLabel}</p>
              </div>
              <button
                onClick={() => base44.auth.logout()}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                title="ログアウト"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="p-1">
            <Menu className="w-5 h-5 text-slate-700" />
          </button>
          <h1 className="text-sm font-bold text-slate-900">工数管理</h1>
        </header>

        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}