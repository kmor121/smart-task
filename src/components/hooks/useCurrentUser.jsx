import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";

export default function useCurrentUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const me = await base44.auth.me();
        setUser(me);
      } catch (e) {
        console.error("Failed to load user:", e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const isAdmin = user?.app_role === "管理者";
  const isSubAdmin = user?.app_role === "副管理者";
  const isSales = user?.department_code === "sales";
  const isGeneral = user?.app_role === "一般";
  const canManageProjects = isAdmin || isSubAdmin || isSales;
  const canReassign = isAdmin || isSubAdmin;

  return { user, loading, isAdmin, isSubAdmin, isSales, isGeneral, canManageProjects, canReassign };
}