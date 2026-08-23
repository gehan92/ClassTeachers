/** Sentinel used for the "no specific batch" bucket, in both the grouping
 * key and the ?batch= filter query param (classes-tab.tsx) — keep in sync. */
export const GENERAL_BATCH_KEY = "general";

type Groupable = { ownerId: string; ownerName: string; batchId: string | null; batchTitle: string | null };

/**
 * Groups student-facing rows (notes, assignments) by (owner, batch) — keyed
 * on ownerId, not ownerName, since two different teachers could
 * coincidentally share a display name. Each group's heading names the
 * class; unassigned rows for that owner fall back to just the owner's name.
 */
export function groupByClass<T extends Groupable>(rows: T[]): { key: string; heading: string; rows: T[] }[] {
  const groups = new Map<string, { heading: string; rows: T[] }>();
  for (const row of rows) {
    const key = `${row.ownerId}::${row.batchId ?? GENERAL_BATCH_KEY}`;
    const heading = row.batchTitle ? `${row.ownerName} — ${row.batchTitle}` : row.ownerName;
    const group = groups.get(key) ?? { heading, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}
