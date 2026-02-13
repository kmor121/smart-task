import React, { useState } from "react";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DebugPanel({ user, isAdmin, isManager, teamData }) {
  const [expanded, setExpanded] = useState(true);

  const meta = teamData?._meta;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg mb-6 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Bug className="w-4 h-4 text-amber-700" />
          <span className="text-sm font-medium text-amber-900">🔍 デバッグ情報</span>
          {!expanded && meta && (
            <Badge variant="outline" className="ml-2 text-xs">
              対象: {meta.result_summary?.target_users_count || 0}名
            </Badge>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-amber-700" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-700" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 text-xs text-slate-700">
          {/* Current User */}
          <div className="bg-white rounded-md p-3 border border-amber-100">
            <h4 className="font-semibold text-amber-900 mb-2">📌 現在のユーザー</h4>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">ID:</span> {user?.id || "N/A"}
              </div>
              <div>
                <span className="text-slate-500">Email:</span> {user?.email || "N/A"}
              </div>
              <div>
                <span className="text-slate-500">Role:</span> {user?.role || "N/A"}
              </div>
              <div>
                <span className="text-slate-500">App Role:</span> {user?.app_role || "N/A"}
              </div>
              <div>
                <span className="text-slate-500">Department:</span> {user?.department_code || user?.department || "N/A"}
              </div>
            </div>
          </div>

          {/* Permission Detection */}
          <div className="bg-white rounded-md p-3 border border-amber-100">
            <h4 className="font-semibold text-amber-900 mb-2">🔐 権限判定</h4>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={isAdmin ? "default" : "outline"}>Admin: {isAdmin ? "✅" : "❌"}</Badge>
                <span className="text-slate-500 text-[10px]">
                  (role=admin OR isAdmin=true OR isOwner=true)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={isManager ? "default" : "outline"}>Manager: {isManager ? "✅" : "❌"}</Badge>
                <span className="text-slate-500 text-[10px]">
                  (role=manager OR app_role=部長)
                </span>
              </div>
              {meta?.current_user && (
                <div className="mt-2 text-[10px] text-slate-500 space-y-1">
                  <div>
                    <span className="text-slate-700 font-semibold">Frontend判定:</span> isAdmin={isAdmin ? "✅" : "❌"} / isManager={isManager ? "✅" : "❌"}<br/>
                    <span className="text-slate-600 text-[9px]">logic: role=admin OR isAdmin OR isOwner</span>
                  </div>
                  <div>
                    <span className="text-slate-700 font-semibold">Backend判定:</span> isAdmin={meta.query_info?.is_admin ? "✅" : "❌"} / isManager={meta.query_info?.is_manager ? "✅" : "❌"}<br/>
                    <span className="text-slate-600 text-[9px]">Backend role: {meta.current_user?.role || "N/A"} / app_role: {meta.current_user?.app_role || "N/A"}</span>
                  </div>
                  {meta.query_info?.is_manager !== isManager && (
                    <div className="mt-1 p-1 bg-red-50 text-red-600 border border-red-200 rounded">
                      ⚠️ Frontend と Backend の isManager が一致しません！Backend の判定ロジックを確認してください
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Backend Effective User */}
          {meta?.effective_user && (
            <div className="bg-white rounded-md p-3 border border-blue-100">
              <h4 className="font-semibold text-blue-900 mb-2">🎭 Backend Effective User</h4>
              <div className="space-y-1 text-[10px]">
                <div>
                  <span className="text-slate-500">email:</span>{" "}
                  <span className="font-mono font-semibold text-blue-600">{meta.effective_user.email}</span>
                </div>
                <div>
                  <span className="text-slate-500">role:</span> {meta.effective_user.role || "N/A"} | 
                  <span className="text-slate-500"> app_role:</span> {meta.effective_user.app_role || "N/A"}
                </div>
                <div>
                  <span className="text-slate-500">department_code:</span>{" "}
                  <span className="font-mono font-semibold text-emerald-600">{meta.effective_user.department_code || "未設定"}</span>
                </div>
                <div>
                  <span className="text-slate-500">isAdmin:</span> {meta.effective_user.is_admin ? "✅" : "❌"} | 
                  <span className="text-slate-500"> isManager:</span> {meta.effective_user.is_manager ? "✅" : "❌"}
                </div>
                {meta.effective_user.is_impersonated && (
                  <div className="mt-1 p-1 bg-amber-50 border border-amber-200 rounded text-amber-700">
                    🎭 Impersonating
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Department Filter */}
          {meta && (
            <div className="bg-white rounded-md p-3 border border-amber-100">
              <h4 className="font-semibold text-amber-900 mb-2">🎯 部署フィルタ</h4>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500">認証ユーザー部署:</span>{" "}
                  <span className="font-mono font-semibold text-blue-600">{meta.auth_user?.department_code || user?.department_code || "未設定"}</span>
                </div>
                <div>
                  <span className="text-slate-500">リクエスト部署:</span>{" "}
                  <span className="font-mono">{meta.query_info?.requested_department || "null (全社)"}</span>
                </div>
                <div>
                  <span className="text-slate-500">実際の検索部署:</span>{" "}
                  <span className="font-mono font-semibold text-blue-600">
                    {meta.query_info?.target_department || "null (全社)"}
                  </span>
                </div>
                {meta.effective_user?.is_manager && !meta.effective_user?.is_admin && (
                  <div className="text-amber-700 text-[10px] mt-1">
                    ✅ 部長は自部署固定（{meta.effective_user.department_code}）
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Users Query Result */}
          {meta && (
            <div className="bg-white rounded-md p-3 border border-amber-100">
              <h4 className="font-semibold text-amber-900 mb-2">👥 ユーザー取得結果</h4>
              <div className="space-y-1">
                <div>
                  <span className="text-slate-500">全ユーザー数（users_total_found）:</span>{" "}
                  <span className="font-mono font-bold">{meta.result_summary?.users_total_found || 0}</span>
                </div>
                <div>
                  <span className="text-slate-500">対象部署のユーザー（users_in_dept_found）:</span>{" "}
                  <span className="font-mono font-bold text-lg text-emerald-600">
                    {meta.result_summary?.users_in_dept_found || 0}名
                  </span>
                </div>
                {meta.result_summary?.users_fetch_error && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[10px]">
                    ❌ ユーザー取得エラー：<br/>
                    <code className="text-red-600">{meta.result_summary.users_fetch_error}</code>
                  </div>
                )}
                {meta.result_summary?.users_total_found === 0 && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-[10px]">
                    ⚠️ Users エンティティにユーザーが登録されていません
                  </div>
                )}
                {meta.result_summary?.users_in_dept_found === 0 && meta.result_summary?.users_total_found > 0 && (
                  <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-amber-700 text-[10px]">
                    ⚠️ 該当部署（{meta.query_info?.target_department}）にユーザーが登録されていません
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Sample Users */}
          {meta?.result_summary?.sample_users?.length > 0 && (
            <div className="bg-white rounded-md p-3 border border-amber-100">
              <h4 className="font-semibold text-amber-900 mb-2">📋 サンプルユーザー（上位3件）</h4>
              <div className="space-y-1 text-[10px]">
                {meta.result_summary.sample_users.map((u, idx) => (
                  <div key={idx} className="py-1 border-b border-amber-50 last:border-0">
                    <div className="font-mono text-slate-700">
                      <div>email: {u.email}</div>
                      <div>department_code: <span className="font-semibold text-blue-600">{u.department_code}</span></div>
                      <div>role: {u.role || "N/A"} | app_role: {u.app_role || "N/A"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sample User Fields */}
          {meta?.result_summary?.sample_user_fields?.length > 0 && (
            <div className="bg-white rounded-md p-3 border border-amber-100">
              <h4 className="font-semibold text-amber-900 mb-2">🔬 ユーザーフィールド一覧（サンプル）</h4>
              <div className="font-mono text-[10px] text-slate-600 space-x-1">
                {meta.result_summary.sample_user_fields.map((field, idx) => (
                  <span key={idx} className="inline-block bg-slate-100 px-1.5 py-0.5 rounded">
                    {field}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Response Metadata */}
          {meta && (
            <details className="bg-white rounded-md p-3 border border-amber-100">
              <summary className="font-semibold text-amber-900 cursor-pointer">
                📦 Full Metadata (JSON)
              </summary>
              <pre className="mt-2 p-2 bg-slate-900 text-slate-100 rounded text-[9px] overflow-auto max-h-64">
                {JSON.stringify(meta, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}