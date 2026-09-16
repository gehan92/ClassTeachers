import { getTranslations } from "next-intl/server";
import { Loader2 } from "lucide-react";

/**
 * First-paint placeholder for the dashboard route groups (teacher/student/
 * institute/admin) — shown by Next.js automatically while each dashboard
 * page's server-side data fetch (roughly a dozen parallel Supabase queries)
 * is still in flight, instead of a blank white screen. Deliberately generic
 * rather than role-specific: the goal is just to make the wait feel
 * intentional and preview the shell shape, not to pixel-match any one
 * role's actual sidebar items.
 *
 * The pulsing placeholder blocks alone read as "blank/broken" at a glance
 * (Gehan flagged this after watching a real Dashboard-button click) rather
 * than obviously "in progress" — the small pill below is the explicit,
 * unambiguous "this is loading" signal layered on top of the same shape
 * preview, the way most polished dashboards (this app's own is one) pair a
 * skeleton with a spinner rather than relying on the pulse alone.
 */
export async function DashboardShellSkeleton() {
  const t = await getTranslations("dashboardShell");

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <header className="flex h-15 shrink-0 items-center justify-between gap-4 border-b border-primary-dark bg-primary-dark px-5">
        <div className="flex items-center gap-2.5">
          <span className="size-7 animate-pulse rounded-[6px] bg-white/15" />
          <span className="h-4 w-28 animate-pulse rounded bg-white/15" />
        </div>
        <div className="flex items-center gap-3">
          <span className="size-8 animate-pulse rounded-md bg-white/10" />
          <span className="size-7 animate-pulse rounded-full bg-white/15" />
        </div>
      </header>

      <div className="shrink-0 border-b border-border bg-white px-4 py-2.5 md:hidden">
        <div className="flex gap-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <span key={i} className="h-7 w-20 shrink-0 animate-pulse rounded-full bg-muted" />
          ))}
        </div>
      </div>

      <div className="flex min-h-0 w-full flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-white p-4 md:block">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <span key={i} className="h-8 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </aside>
        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto p-5 sm:p-7">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-5">
            <div className="h-8 w-48 animate-pulse rounded bg-muted" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-lg border border-border bg-muted/60" />
              ))}
            </div>
            <div className="h-64 animate-pulse rounded-lg border border-border bg-muted/60" />
          </div>

          <div className="pointer-events-none sticky bottom-5 left-0 flex w-full justify-center">
            <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-medium text-foreground/80 shadow-[0_4px_16px_-4px_rgba(14,33,29,0.25)]">
              <Loader2 className="size-4 animate-spin text-primary" />
              {t("loading")}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
