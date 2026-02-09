import React from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from "recharts";

export default function ProjectTimeChart({ data }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400 text-sm">
        データがありません
      </div>
    );
  }

  const chartData = data.slice(0, 15).map(d => ({
    name: d.project_name.length > 12 ? d.project_name.slice(0, 12) + "…" : d.project_name,
    total_hours: +(d.total_minutes / 60).toFixed(1),
    revision_hours: +(d.revision_minutes / 60).toFixed(1),
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "#64748b" }}
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis tick={{ fontSize: 11, fill: "#64748b" }} unit="h" />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13 }}
          formatter={(value, name) => [
            `${value}h`,
            name === "total_hours" ? "総作業時間" : "修正時間",
          ]}
        />
        <Legend
          formatter={(value) => (value === "total_hours" ? "総作業時間" : "修正時間")}
          wrapperStyle={{ fontSize: 12 }}
        />
        <Bar dataKey="total_hours" fill="#1e293b" radius={[4, 4, 0, 0]} />
        <Bar dataKey="revision_hours" fill="#f97316" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}