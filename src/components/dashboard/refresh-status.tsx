"use client";

export function RefreshStatus({
  pending,
  stuck,
  pendingLabel,
  stuckLabel,
  reloadLabel,
  className,
}: {
  pending: boolean;
  stuck: boolean;
  pendingLabel: string;
  stuckLabel: string;
  reloadLabel: string;
  className?: string;
}) {
  if (stuck) {
    return (
      <div className={`flex flex-wrap items-center gap-2 text-sm text-destructive ${className ?? ""}`}>
        <span>{stuckLabel}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="font-medium underline underline-offset-2"
        >
          {reloadLabel}
        </button>
      </div>
    );
  }
  if (pending) {
    return <span className={`text-sm text-muted-foreground ${className ?? ""}`}>{pendingLabel}</span>;
  }
  return null;
}
