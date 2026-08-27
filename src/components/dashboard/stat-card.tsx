import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const toneClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  cta: "bg-cta/15 text-accent-deep",
  destructive: "bg-destructive/10 text-destructive",
} as const;

export function StatCard({
  label,
  value,
  delta,
  deltaDown,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaDown?: boolean;
  /** Optional — omitting it keeps the original plain layout used elsewhere (Overview tab etc.) unchanged. */
  icon?: LucideIcon;
  tone?: keyof typeof toneClasses;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
          <div className="font-display text-2xl text-primary">{value}</div>
          {delta && (
            <div className={cn("mt-1 text-xs font-medium", deltaDown ? "text-lock" : "text-success")}>{delta}</div>
          )}
        </div>
        {Icon && (
          <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", toneClasses[tone])}>
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
    </div>
  );
}
