import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label, value, sub, tone = "default", icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "default" | "success" | "warning" | "destructive";
  icon?: ReactNode;
}) {
  const toneCls = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  }[tone];
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon}
      </div>
      <div className={cn("mt-2 font-display text-2xl font-bold tracking-tight md:text-3xl", toneCls)}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
