/**
 * Shared with the student dashboard's server page (student/page.tsx), which
 * needs the exact same "has this actually ended" rule to count how many
 * sessions belong in the Live Classes history tab — kept here rather than
 * in student/live-classes-tab.tsx (a "use client" file) so a server
 * component can import it without crossing the client boundary.
 */
export type LiveClassStatus = "scheduled" | "live" | "completed" | "cancelled";
export type LiveState = "not_open" | "starting_soon" | "live" | "ended";

export function classState(
  row: { scheduledAtIso: string; durationMinutes: number; status: LiveClassStatus },
  nowMs: number,
): LiveState {
  const start = new Date(row.scheduledAtIso).getTime();
  const end = start + row.durationMinutes * 60 * 1000;
  if (row.status === "completed" || row.status === "cancelled") return "ended";
  if (row.status === "live") {
    // Trust the host's own "still going"/"I ended it" signal first; the
    // time check here is only a safety net for a session that crashed or
    // closed without cleanly leaving, so it doesn't read as live forever.
    return nowMs > end ? "ended" : "live";
  }
  if (nowMs >= start && nowMs <= end) return "live";
  if (nowMs > end) return "ended";
  if (start - nowMs <= 15 * 60 * 1000) return "starting_soon";
  return "not_open";
}
