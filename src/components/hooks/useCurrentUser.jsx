import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await base44.auth.me();
        
        // テストユーザー切替（Preview環境専用）
        const impersonateData = localStorage.getItem("impersonateUser");
        if (impersonateData) {
          const testUser = JSON.parse(impersonateData);
          setUser({
            ...me,
            id: testUser.id,
            email: testUser.email,
            full_name: testUser.full_name,
            department_code: testUser.department_code,
            app_role: testUser.app_role,
            role: testUser.role || "user",
            isAdmin: testUser.isAdmin === true,
            isOwner: testUser.isOwner === true,
            _isImpersonating: true,
            _realUser: me,
          });
        } else {
          setUser(me);
        }
      } catch (e) {
        console.error("Failed to load user:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isAdmin = user?.role === "admin" || user?.isOwner === true || user?.isAdmin === true;
  const isSubAdmin = user?.app_role === "副管理者";
  const isSales = user?.department_code === "sales";
  const isGeneral = user?.app_role === "一般";
  const canManageProjects = isAdmin || isSubAdmin || isSales;
  const canReassign = isAdmin || isSubAdmin;

  return { user, loading, isAdmin, isSubAdmin, isSales, isGeneral, canManageProjects, canReassign };
}