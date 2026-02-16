import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import { toast } from "sonner";

const DEPT_LABELS = {
  sales: "営業",
  design: "制作",
  ict: "ICT",
  print: "印刷",
  binding: "製本",
  general: "総務"
};

export default function CreateTestDailyLogsButton({ queryClient }) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedDept, setSelectedDept] = useState("design");

  const handleCreate = async () => {
    setIsLoading(true);
    try {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      const response = await base44.functions.invoke("createTestDailyLogs", {
        work_date: dateStr,
        department_code: selectedDept
      });

      const result = response.data;

      if (result.success) {
        toast.success(
          `✅ ${result.created_count}件のテスト日報を作成しました（対象: ${result.target_users_count}人）`
        );
        
        // キャッシュ無効化
        queryClient.invalidateQueries({ queryKey: ["teamDailyLogs"] });
        queryClient.invalidateQueries({ queryKey: ["workLogs"] });
      } else {
        toast.error(`❌ エラー: ${result.error || "不明"}`);
      }
    } catch (error) {
      console.error('createTestDailyLogs error:', error);
      toast.error(`❌ エラー: ${error.message || "実行に失敗しました"}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">日付</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start text-left font-normal">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(selectedDate, "yyyy年M月d日(E)", { locale: ja })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                locale={ja}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-2 block">部署</label>
          <Select value={selectedDept} onValueChange={setSelectedDept}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(DEPT_LABELS).map(([code, label]) => (
                <SelectItem key={code} value={code}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleCreate} 
        disabled={isLoading}
        className="w-full gap-2"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            作成中...
          </>
        ) : (
          "テスト日報を作成"
        )}
      </Button>
    </div>
  );
}