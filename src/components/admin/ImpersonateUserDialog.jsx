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
  const [searchTerm, setSearchTerm] = useState("");

  const handleSelectUser = (testUser) => {
    localStorage.setItem("impersonateUser", JSON.stringify(testUser));
    window.location.reload();
  };

  // 管理者・部長・一般に分類
  const { admins, managers, staffByDept } = useMemo(() => {
    const admins = TEST_USERS.filter(u => u.role === "admin").sort((a, b) => a.full_name.localeCompare(b.full_name));
    const managers = TEST_USERS.filter(u => u.role === "manager").sort((a, b) => {
      if (a.department_code !== b.department_code) return a.department_code.localeCompare(b.department_code);
      return a.full_name.localeCompare(b.full_name);
    });
    
    const staffUsers = TEST_USERS.filter(u => u.role === "staff");
    const grouped = {};
    staffUsers.forEach(u => {
      if (!grouped[u.department_code]) grouped[u.department_code] = [];
      grouped[u.department_code].push(u);
    });
    
    // 各部署内で名前順ソート
    Object.keys(grouped).forEach(dept => {
      grouped[dept].sort((a, b) => a.full_name.localeCompare(b.full_name));
    });
    
    return { admins, managers, staffByDept: grouped };
  }, []);

  // 検索フィルタ
  const filteredStaffByDept = useMemo(() => {
    if (!searchTerm) return staffByDept;
    
    const filtered = {};
    Object.entries(staffByDept).forEach(([dept, users]) => {
      const matchedUsers = users.filter(u => 
        u.full_name.includes(searchTerm) || 
        DEPT_LABELS[u.department_code]?.includes(searchTerm)
      );
      if (matchedUsers.length > 0) {
        filtered[dept] = matchedUsers;
      }
    });
    return filtered;
  }, [staffByDept, searchTerm]);

  const UserButton = ({ user }) => (
    <button
      onClick={() => handleSelectUser(user)}
      className="w-full flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors text-left"
    >
      <UserCircle className="w-7 h-7 text-slate-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 text-sm">{user.full_name}</p>
        <p className="text-xs text-slate-500">{DEPT_LABELS[user.department_code] || user.department_code}</p>
      </div>
      {user.role !== "staff" && (
        <Badge variant="outline" className="text-xs">{user.app_role}</Badge>
      )}
    </button>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            テストユーザー切替
          </DialogTitle>
          <p className="text-sm text-slate-500 pt-1">
            ⚠️ Preview環境専用：日報入力や権限をテストできます
          </p>
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
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="名前・部署で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
              {Object.keys(filteredStaffByDept).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">該当なし</p>
              ) : (
                Object.entries(filteredStaffByDept)
                  .sort(([deptA], [deptB]) => deptA.localeCompare(deptB))
                  .map(([dept, users]) => (
                    <div key={dept}>
                      <h4 className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1">
                        {DEPT_LABELS[dept] || dept}
                        <span className="text-slate-400">({users.length})</span>
                      </h4>
                      <div className="space-y-1.5">
                        {users.map(user => <UserButton key={user.id} user={user} />)}
                      </div>
                    </div>
                  ))
              )}
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