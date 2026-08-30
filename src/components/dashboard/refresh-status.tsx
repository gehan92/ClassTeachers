"use client";

import { Loader2 } from "lucide-react";

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
      <div
        className={`flex flex-wrap items-center gap-2 text-sm text-destructive animate-in fade-in-0 duration-200 ${className ?? ""}`}
      >
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
    return (
      <span
        className={`flex items-center gap-1.5 text-sm text-muted-foreground animate-in fade-in-0 duration-200 ${className ?? ""}`}
      >
        <Loader2 className="size-3.5 animate-spin" />
        {pendingLabel}
      </span>
    );
  }
  return null;
}
