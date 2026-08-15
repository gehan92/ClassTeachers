import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  delta,
  deltaDown,
}: {
  label: string;
  value: string | number;
  delta?: string;
  deltaDown?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-display text-2xl text-primary">{value}</div>
      {delta && (
        <div className={cn("mt-1 text-xs font-medium", deltaDown ? "text-lock" : "text-success")}>{delta}</div>
      )}
    </div>
  );
}
