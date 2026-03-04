import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function EditProjectDialog({ open, onOpenChange, project, onSuccess }) {
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (project) {
      setTitle(project.project_title || "");
    } else {
      setTitle("");
    }
  }, [project]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error("案件名を入力してください");
      return;
    }

    setSaving(true);
    try {
      const response = await base44.functions.invoke("updateProject", {
        projectId: project.id,
        project_date: project.project_date,
        project_title: trimmedTitle,
      });

      console.log('📥 Server response:', response.data);

      if (response.data.success) {
        toast.success("案件名を更新しました");
        if (onSuccess) await onSuccess();
        onOpenChange(false);
      } else {
        toast.error(response.data.error || "更新に失敗しました");
      }
    } catch (error) {
      toast.error("案件名の更新に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>案件名を編集</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="project-name">案件名</Label>
            <Input
              id="project-name"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="案件名を入力"
              maxLength={200}
              disabled={saving}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !saving) handleSave();
              }}
            />
            {project && (
              <p className="text-xs text-slate-500">
                顧客: {project.client_name || "—"}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            キャンセル
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}