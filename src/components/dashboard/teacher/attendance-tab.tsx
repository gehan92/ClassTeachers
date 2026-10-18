"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { RollCallDialog } from "@/components/dashboard/roll-call-dialog";
import { setAttendanceStatus } from "@/lib/dashboard/live-classes-actions";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { cn } from "@/lib/utils";

type AttendanceStatus = "present" | "absent" | "late";
const STATUSES: AttendanceStatus[] = ["present", "late", "absent"];

export type AttendanceSession = {
  id: string;
  title: string;
  dateLabel: string;
  rows: { studentId: string; studentName: string; status: AttendanceStatus | null }[];
};

function statusVariant(status: AttendanceStatus) {
  if (status === "present") return "active" as const;
  if (status === "late") return "pending" as const;
  return "flagged" as const;
}

export function AttendanceTab({
  sessions,
  batches,
}: {
  sessions: AttendanceSession[];
  /** The teacher's own classes plus any institute classes they teach. */
  batches: { id: string; title: string }[];
}) {
  const t = useTranslations("teacherDashboard.attendance");
  const tr = useTranslations("dashboardCommon.rollCall");
  const { refresh } = useDashboardRefresh();
  const [sessionId, setSessionId] = useState<string>(sessions[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  const session = useMemo(() => sessions.find((s) => s.id === sessionId), [sessions, sessionId]);
  const unmarkedRows = session
    ? session.rows.filter((row) => !(overrides[`${session.id}:${row.studentId}`] ?? row.status))
    : [];

  async function updateStatus(studentId: string, status: AttendanceStatus) {
    if (!session) return;
    const key = `${session.id}:${studentId}`;
    setSavingKey(key);
    const result = await setAttendanceStatus({ liveClassId: session.id, studentId, status });
    setSavingKey(null);
    if (!result.error) {
      setOverrides((prev) => ({ ...prev, [key]: status }));
    }
  }

  async function markRemainingPresent() {
    if (!session || unmarkedRows.length === 0) return;
    setMarkingAll(true);
    const results = await Promise.all(
      unmarkedRows.map((row) =>
        setAttendanceStatus({ liveClassId: session.id, studentId: row.studentId, status: "present" }).then((r) => ({
          studentId: row.studentId,
          ok: !r.error,
        })),
      ),
    );
    setOverrides((prev) => {
      const next = { ...prev };
      for (const r of results) if (r.ok) next[`${session.id}:${r.studentId}`] = "present";
      return next;
    });
    setMarkingAll(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <RollCallDialog
          batches={batches}
          onCreated={(id) => {
            setSessionId(id);
            refresh();
          }}
        />
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
          <p className="text-sm font-medium text-foreground">{tr("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{tr("emptyHint")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <Select value={sessionId} onValueChange={(value) => setSessionId(value as string)}>
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title} · {s.dateLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {session && (
            <div className="rounded-lg border border-border bg-white p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base text-foreground">{session.title}</h3>
                  <p className="text-xs text-muted-foreground">
                    {session.dateLabel} ·{" "}
                    {tr("markedCount", { marked: session.rows.length - unmarkedRows.length, total: session.rows.length })}
                  </p>
                </div>
                {unmarkedRows.length > 0 && (
                  <Button type="button" size="sm" variant="outline" onClick={markRemainingPresent} disabled={markingAll}>
                    {markingAll ? tr("marking") : tr("markRemainingPresent", { count: unmarkedRows.length })}
                  </Button>
                )}
              </div>
              {session.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noRecords")}</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {session.rows.map((row) => {
                    const key = `${session.id}:${row.studentId}`;
                    const status = overrides[key] ?? row.status;
                    return (
                      <div
                        key={row.studentId}
                        className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-border p-3"
                      >
                        <span className="font-medium text-foreground">{row.studentName}</span>
                        <div className="flex items-center gap-2">
                          {status && <StatusBadge variant={statusVariant(status)}>{t(`status.${status}`)}</StatusBadge>}
                          <div className="flex gap-1">
                            {STATUSES.map((s) => (
                              <button
                                key={s}
                                type="button"
                                disabled={savingKey === key || markingAll}
                                onClick={() => updateStatus(row.studentId, s)}
                                className={cn(
                                  "rounded-sm border px-2.5 py-1 text-xs font-medium transition-colors",
                                  status === s
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-white text-muted-foreground hover:bg-secondary",
                                )}
                              >
                                {t(`status.${s}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
