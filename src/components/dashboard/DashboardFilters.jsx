import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function DashboardFilters({ filters, onChange, clients, departments }) {
  const update = (field, value) => {
    onChange({ ...filters, [field]: value === "_all" ? "" : value });
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <div>
        <Label className="text-xs text-slate-500 mb-1 block">開始日</Label>
        <Input
          type="date"
          value={filters.startDate}
          onChange={e => update("startDate", e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500 mb-1 block">終了日</Label>
        <Input
          type="date"
          value={filters.endDate}
          onChange={e => update("endDate", e.target.value)}
          className="h-9 text-sm"
        />
      </div>
      <div>
        <Label className="text-xs text-slate-500 mb-1 block">顧客</Label>
        <Select value={filters.clientId || "_all"} onValueChange={v => update("clientId", v)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label className="text-xs text-slate-500 mb-1 block">部署</Label>
        <Select value={filters.departmentCode || "_all"} onValueChange={v => update("departmentCode", v)}>
          <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">すべて</SelectItem>
            <SelectItem value="sales">営業部</SelectItem>
            <SelectItem value="design">制作部</SelectItem>
            <SelectItem value="print">印刷部</SelectItem>
            <SelectItem value="binding">製本部</SelectItem>
            <SelectItem value="general">総務部</SelectItem>
            <SelectItem value="admin">管理者</SelectItem>
            <SelectItem value="ict">ICT部</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}