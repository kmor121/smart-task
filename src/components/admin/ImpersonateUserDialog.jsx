import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Users, Check } from "lucide-react";
import useCurrentUser from "../hooks/useCurrentUser";

const TEST_USERS = [
  { id: "test_admin", email: "test_admin@example.com", full_name: "管理者テスト", department_code: "admin", app_role: "管理者", role: "admin", isAdmin: true },
  { id: "test_sales_manager", email: "test_sales_manager@example.com", full_name: "営業部長", department_code: "sales", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
  { id: "test_design_manager", email: "test_design_manager@example.com", full_name: "制作部長", department_code: "design", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
  { id: "test_ict_manager", email: "test_ict_manager@example.com", full_name: "ICT部長", department_code: "ict", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
  { id: "test_print_manager", email: "test_print_manager@example.com", full_name: "印刷部長", department_code: "print", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
  { id: "test_binding_manager", email: "test_binding_manager@example.com", full_name: "製本部長", department_code: "binding", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
  { id: "test_sales", email: "test_sales@example.com", full_name: "営業テスト", department_code: "sales", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_sales_2", email: "test_sales_2@example.com", full_name: "営業テスト2", department_code: "sales", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_design", email: "test_design@example.com", full_name: "制作テスト", department_code: "design", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_design_2", email: "test_design_2@example.com", full_name: "制作テスト2", department_code: "design", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_design_3", email: "test_design_3@example.com", full_name: "制作テスト3", department_code: "design", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_ict", email: "test_ict@example.com", full_name: "ICTテスト", department_code: "ict", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_print", email: "test_print@example.com", full_name: "印刷テスト", department_code: "print", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_print_2", email: "test_print_2@example.com", full_name: "印刷テスト2", department_code: "print", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_binding", email: "test_binding@example.com", full_name: "製本テスト", department_code: "binding", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
  { id: "test_general", email: "test_general@example.com", full_name: "総務テスト", department_code: "general", app_role: "一般", role: "staff", isAdmin: false, isOwner: false },
];

const DEPT_LABELS = {
  admin: "管理部",
  sales: "営業部",
  design: "制作部",
  ict: "ICT部",
  print: "印刷部",
  printing: "印刷部",
  binding: "製本部",
  general: "総務部",
};

export default function ImpersonateUserDialog({ open, onOpenChange }) {
  const { user: currentUser } = useCurrentUser();

  const handleSelectUser = (testUser) => {
    // sessionStorage に impersonate_user_email を保存
    sessionStorage.setItem("impersonate_user_email", testUser.email);
    localStorage.setItem("impersonateUser", JSON.stringify(testUser));
    window.location.reload();
  };

  // 管理者・部長・一般に分類
  const { admins, managers, allowedStaff } = useMemo(() => {
    const admins = TEST_USERS.filter(u => u.role === "admin").sort((a, b) => a.full_name.localeCompare(b.full_name));
    
    // 部長の表示順を固定
    const managerOrder = { sales: 1, design: 2, ict: 3, print: 4, binding: 5 };
    const managers = TEST_USERS.filter(u => u.role === "manager").sort((a, b) => {
      const orderA = managerOrder[a.department_code] || 999;
      const orderB = managerOrder[b.department_code] || 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.full_name.localeCompare(b.full_name);
    });
    
    // 右カラムに表示する一般ユーザー（固定6名のみ）
    const allowedNames = ["総務テスト", "営業テスト", "制作テスト", "ICTテスト", "印刷テスト", "製本テスト"];
    const allowedStaff = allowedNames
      .map(name => TEST_USERS.find(u => u.full_name === name))
      .filter(Boolean);
    
    return { admins, managers, allowedStaff };
  }, []);

  const UserButton = ({ user }) => {
    const isCurrent = currentUser?.id === user.id;
    
    return (
      <button
        onClick={() => handleSelectUser(user)}
        aria-current={isCurrent ? "true" : undefined}
        className={`
          w-full flex items-center gap-2 p-2.5 rounded-lg border transition-colors text-left cursor-pointer
          ${isCurrent 
            ? "bg-slate-100 border-slate-300 border-l-4 border-l-slate-500" 
            : "border-slate-200 hover:bg-slate-50 active:bg-slate-200"
          }
        `}
      >
        <UserCircle className="w-7 h-7 text-slate-400 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 text-sm">{user.full_name}</p>
          <p className="text-xs text-slate-500">{DEPT_LABELS[user.department_code] || user.department_code}</p>
        </div>
        {isCurrent && (
          <Badge className="bg-slate-600 text-white text-xs px-2">現在</Badge>
        )}
        {!isCurrent && user.role !== "staff" && (
          <Badge variant="outline" className="text-xs">{user.app_role}</Badge>
        )}
      </button>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            テストユーザー切替
          </DialogTitle>
          <div className="space-y-1 pt-1">
            <p className="text-sm text-slate-500">
              ⚠️ Preview環境専用：日報入力や権限をテストできます
            </p>
            {currentUser && (
              <p className="text-xs text-slate-600 flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5" />
                現在：<span className="font-medium">{currentUser.full_name}</span>
                <span className="text-slate-400">（{DEPT_LABELS[currentUser.department_code] || currentUser.department_code}）</span>
              </p>
            )}
          </div>
        </DialogHeader>

        <div className="grid lg:grid-cols-2 gap-6 flex-1 overflow-hidden py-4">
          {/* 左カラム：管理系 */}
          <div className="space-y-4 overflow-y-auto pr-2">
            {/* 管理者 */}
            <div>
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-slate-800 rounded" />
                管理者
              </h3>
              <div className="space-y-2">
                {admins.map(user => <UserButton key={user.id} user={user} />)}
              </div>
            </div>

            {/* 部長 */}
            {managers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-1 h-4 bg-slate-600 rounded" />
                  部長
                </h3>
                <div className="space-y-2">
                  {managers.map(user => <UserButton key={user.id} user={user} />)}
                </div>
              </div>
            )}
          </div>

          {/* 右カラム：一般 */}
          <div className="flex flex-col overflow-hidden border-l lg:border-l pl-0 lg:pl-6">
            <div className="mb-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2 flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded" />
                一般ユーザー
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {allowedStaff.map(user => <UserButton key={user.id} user={user} />)}
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}