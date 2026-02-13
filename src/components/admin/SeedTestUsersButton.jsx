import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function SeedTestUsersButton({ queryClient }) {
  const [isLoading, setIsLoading] = useState(false);

  const handleSeedUsers = async () => {
    setIsLoading(true);
    try {
      const response = await base44.functions.invoke("seedTestUsers", {});
      const result = response.data;

      if (result.success) {
        toast.success(
          `✅ ${result.summary.created_or_updated}人のテストユーザーを作成/更新しました\n全ユーザー: ${result.summary.total_users}人、制作部: ${result.summary.design_users}人`
        );
        
        // キャッシュ無効化
        queryClient.invalidateQueries({ queryKey: ["teamDailyLogs"] });
      } else {
        toast.error(`❌ エラー: ${result.error || "不明"}`);
      }
    } catch (error) {
      console.error('seedTestUsers error:', error);
      toast.error(`❌ エラー: ${error.message || "実行に失敗しました"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleSeedUsers} 
      disabled={isLoading}
      className="gap-2"
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          作成中...
        </>
      ) : (
        "テストユーザーを作成"
      )}
    </Button>
  );
}