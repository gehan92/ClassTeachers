"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { restoreAd } from "@/lib/dashboard/ads-actions";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";

export type AdHistoryRow = { id: string; title?: string; content: string; meta?: string };

/**
 * Read-only archive of deleted ads/promotions (0109's soft-delete), with a
 * one-click Restore back to paused so the owner can review before making it
 * live again — see restoreAd's own comment for why it lands on 'removed'
 * rather than jumping straight back to 'active'.
 */
export function AdHistoryList({
  items,
  ownerType,
  restoreLabel,
  restoredLabel,
}: {
  items: AdHistoryRow[];
  ownerType: "teacher" | "class";
  restoreLabel: string;
  restoredLabel: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col divide-y divide-border">
      {items.map((item) => (
        <AdHistoryRowItem
          key={item.id}
          item={item}
          ownerType={ownerType}
          restoreLabel={restoreLabel}
          restoredLabel={restoredLabel}
        />
      ))}
    </div>
  );
}

function AdHistoryRowItem({
  item,
  ownerType,
  restoreLabel,
  restoredLabel,
}: {
  item: AdHistoryRow;
  ownerType: "teacher" | "class";
  restoreLabel: string;
  restoredLabel: string;
}) {
  const { refresh } = useDashboardRefresh();
  const [restoring, setRestoring] = useState(false);
  const [restored, setRestored] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRestore() {
    setRestoring(true);
    setError(null);
    const result = await restoreAd({ adId: item.id, ownerType });
    setRestoring(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRestored(true);
    refresh();
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        {item.meta && <p className="text-xs text-muted-foreground">{item.meta}</p>}
        {item.title && <p className="text-sm font-medium text-foreground">{item.title}</p>}
        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.content}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {restored ? (
          <span className="text-sm font-medium text-success">{restoredLabel}</span>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={handleRestore} disabled={restoring}>
            {restoreLabel}
          </Button>
        )}
        {error && <span className="text-sm font-medium text-destructive">{error}</span>}
      </div>
    </div>
  );
}
