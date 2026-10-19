"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, History, KeyRound, Loader2, School, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/school/native-select";
import { downloadCsv } from "@/components/dashboard/admin/reports/report-kit";
import { loadSchoolHistory } from "@/lib/school/actions";
import { SCHOOL_AREA_KEYS } from "@/lib/school/catalog";
import type { SchoolHistoryRow } from "@/types/school";

const AREA_ICONS: Record<string, typeof History> = {
  settings: School,
  roles: KeyRound,
};

/** One change as a sentence: "Mrs Perera changed the role Vice Principal". */
export function HistoryEventLine({ row }: { row: SchoolHistoryRow }) {
  const t = useTranslations("school.history");
  const sentence = t.has(`events.${row.event}`)
    ? t.rich(`events.${row.event}`, {
        actor: row.actorName,
        label: row.entityLabel,
        b: (chunks) => <span className="font-semibold text-foreground">{chunks}</span>,
      })
    : `${row.actorName} · ${row.event} · ${row.entityLabel}`;
  return <span className="text-foreground/85">{sentence}</span>;
}

/**
 * Every change at the school, newest first and never edited: who did it,
 * when, and what it was before. Loads 50 at a time.
 */
export function SchoolHistoryTab({
  schoolId,
  initialRows,
  initialHasMore,
  canExport,
}: {
  schoolId: string;
  initialRows: SchoolHistoryRow[];
  initialHasMore: boolean;
  canExport: boolean;
}) {
  const t = useTranslations("school.history");
  const ts = useTranslations("school");
  const [area, setArea] = useState<string>("");
  const [rows, setRows] = useState(initialRows);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextArea: string, offset: number) {
    setLoading(true);
    setError(null);
    const result = await loadSchoolHistory({ schoolId, area: nextArea || null, offset });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRows((prev) => (offset === 0 ? result.rows : [...prev, ...result.rows]));
    setHasMore(result.hasMore);
  }

  function changeArea(next: string) {
    setArea(next);
    load(next, 0);
  }

  function exportCsv() {
    downloadCsv(
      "school-history",
      [t("csv.when"), t("csv.who"), t("csv.area"), t("csv.what"), t("csv.details")],
      rows.map((r) => [
        r.createdAt,
        r.actorName,
        (SCHOOL_AREA_KEYS as string[]).includes(r.area) ? ts(`areas.${r.area}.label`) : r.area,
        t.has(`eventsPlain.${r.event}`) ? t(`eventsPlain.${r.event}`, { label: r.entityLabel }) : `${r.event} ${r.entityLabel}`,
        r.changes.map((c) => (c.from ? `${c.field}: ${c.from} → ${c.to}` : `${c.field}: ${c.to}`)).join(" | "),
      ]),
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect aria-label={t("filterLabel")} value={area} onChange={(e) => changeArea(e.target.value)} className="w-auto min-w-44">
            <option value="">{t("allAreas")}</option>
            {SCHOOL_AREA_KEYS.map((key) => (
              <option key={key} value={key}>
                {ts(`areas.${key}.label`)}
              </option>
            ))}
          </NativeSelect>
          {canExport && (
            <Button type="button" variant="outline" size="sm" onClick={exportCsv} disabled={rows.length === 0}>
              <Download className="size-3.5" />
              {t("export")}
            </Button>
          )}
        </div>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      {rows.length === 0 && !loading ? (
        <div className="rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
          <p className="text-sm text-muted-foreground">{area ? t("emptyArea") : t("empty")}</p>
        </div>
      ) : (
        <ol className="relative flex flex-col gap-0 rounded-xl border border-border bg-white" aria-busy={loading}>
          {rows.map((row) => {
            const Icon = AREA_ICONS[row.area] ?? ShieldCheck;
            return (
              <li key={row.id} className="flex gap-3.5 border-b border-border px-4 py-3.5 last:border-b-0 sm:px-5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                    <p className="text-sm break-words">
                      <HistoryEventLine row={row} />
                    </p>
                    <time dateTime={row.createdAtIso} className="shrink-0 text-xs text-muted-foreground tabular-nums">
                      {row.createdAt}
                    </time>
                  </div>
                  {row.changes.length > 0 && (
                    <dl className="mt-2 flex flex-col gap-1 rounded-md bg-muted/50 px-3 py-2 text-xs">
                      {row.changes.map((c, i) => (
                        <div key={i} className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
                          <dt className="shrink-0 font-semibold text-foreground/80">{c.field}</dt>
                          <dd className="m-0 break-words text-muted-foreground">
                            {c.from ? (
                              <>
                                <span className="line-through decoration-muted-foreground/50">{c.from}</span>
                                {" → "}
                                <span className="text-foreground">{c.to}</span>
                              </>
                            ) : (
                              c.to
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {(hasMore || loading) && (
        <div className="flex justify-center">
          <Button type="button" variant="outline" onClick={() => load(area, rows.length)} disabled={loading}>
            {loading && <Loader2 className="size-4 animate-spin" />}
            {loading ? t("loading") : t("loadMore")}
          </Button>
        </div>
      )}
    </div>
  );
}
