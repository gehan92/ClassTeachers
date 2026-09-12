/**
 * Groups student-facing rows (notes, assignments) by (owner, batch) rather
 * than batch alone — a student can be enrolled with several different
 * teachers/institutes, and two of them could coincidentally name a batch
 * the same thing, so batchId alone isn't a safe display key across owners.
 * Each group's heading names the class; unassigned rows for that owner fall
 * back to just the owner's name.
 *
 * Keyed on ownerId, not ownerName — two different teachers/institutes can
 * coincidentally share a display name (a real risk with common Sinhala/
 * Tamil names), and keying on the name alone would merge their content
 * into one group, misattributing one owner's notes/exams to the other.
 */
export function groupByClass<
  T extends { ownerId: string; ownerName: string; batchId: string | null; batchTitle: string | null },
>(rows: T[]): { key: string; heading: string; rows: T[] }[] {
  const groups = new Map<string, { heading: string; rows: T[] }>();
  for (const row of rows) {
    const key = `${row.ownerId}::${row.batchId ?? "general"}`;
    const heading = row.batchTitle ? `${row.ownerName} — ${row.batchTitle}` : row.ownerName;
    const group = groups.get(key) ?? { heading, rows: [] };
    group.rows.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].map(([key, group]) => ({ key, ...group }));
}
