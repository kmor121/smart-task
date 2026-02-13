import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserCircle, Users, Search } from "lucide-react";

const TEST_USERS = [
  { id: "test_admin", email: "test_admin@example.com", full_name: "管理者テスト", department_code: "admin", app_role: "管理者", role: "admin", isAdmin: true },
  { id: "test_sales_manager", email: "test_sales_manager@example.com", full_name: "営業部長", department_code: "sales", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
  { id: "test_design_manager", email: "test_design_manager@example.com", full_name: "制作部長", department_code: "design", app_role: "部長", role: "manager", isAdmin: false, isOwner: false },
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
  const handleSelectUser = (testUser) => {
    localStorage.setItem("impersonateUser", JSON.stringify(testUser));
    window.location.reload();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            テストユーザー切替
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 py-4">
          <p className="text-sm text-slate-500 mb-4">
            ⚠️ Preview環境専用：日報入力や権限をテストできます
          </p>
          {TEST_USERS.map(testUser => (
            <button
              key={testUser.id}
              onClick={() => handleSelectUser(testUser)}
              className="w-full flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
            >
              <UserCircle className="w-8 h-8 text-slate-400" />
              <div>
                <p className="font-medium text-slate-800">{testUser.full_name}</p>
                <p className="text-xs text-slate-500">
                  {testUser.department_code} · {testUser.app_role}
                </p>
              </div>
            </button>
          ))}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            キャンセル
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}