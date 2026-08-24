"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type RealtimeWatch = {
  table: string;
  /** Postgres changes filter, e.g. `owner_id=eq.<uuid>` — omit to watch every row of the table (see note below on why some watches can't be scoped this tightly). */
  filter?: string;
};

/**
 * Silent, invisible trigger for the "needs to feel alive" spots (new
 * inquiry, new join request, a submission coming in, attendance being
 * marked) — subscribes to Postgres change events via Supabase Realtime and
 * calls router.refresh() whenever a matching row changes, so the dashboard
 * updates on its own without the viewer clicking anything.
 *
 * Deliberately just a trigger: on a matching event it re-fetches through
 * the existing server-rendered path instead of merging the raw realtime
 * payload into already-formatted display data. That keeps every bit of
 * joining/translation/grouping logic in the one place it already lives
 * (the page.tsx queries) rather than duplicating it client-side.
 *
 * Some watched tables (exam_submissions, assignment_submissions,
 * attendance_records) have no direct owner_id column of their own — the
 * ownership link is one hop away, through exam_id/assignment_id/
 * live_class_id — and Realtime's postgres_changes filter can only match a
 * literal column on the table being watched. Those watches go unfiltered
 * (every teacher's dashboard subscribes to every row of that table), which
 * is a performance trade-off, not a security one: the actual refetch is
 * still fully RLS-scoped server-side, so an unfiltered watch just means an
 * occasional unnecessary refresh, never someone else's data. Fine at the
 * traffic this product sees today.
 */
export function RealtimeRefresh({ watch }: { watch: RealtimeWatch[] }) {
  const router = useRouter();

  useEffect(() => {
    if (watch.length === 0) return;
    const supabase = createClient();
    const channel = supabase.channel(`dashboard-realtime-${watch.map((w) => w.table).join("-")}`);
    for (const { table, filter } of watch) {
      channel.on(
        "postgres_changes",
        filter
          ? { event: "*", schema: "public", table, filter }
          : { event: "*", schema: "public", table },
        () => router.refresh(),
      );
    }
    channel.subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribe once per mount; `watch` is a fresh array each render but its contents (this viewer's own id) never change for the life of the page
  }, []);

  return null;
}
