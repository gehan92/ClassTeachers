"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { setAttendanceStatus } from "@/lib/dashboard/live-classes-actions";
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

export function AttendanceTab({ sessions }: { sessions: AttendanceSession[] }) {
  const t = useTranslations("teacherDashboard.attendance");
  const [sessionId, setSessionId] = useState<string>(sessions[0]?.id ?? "");
  const [overrides, setOverrides] = useState<Record<string, AttendanceStatus>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const session = useMemo(() => sessions.find((s) => s.id === sessionId), [sessions, sessionId]);

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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">{t("noRecords")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2.5">
            <Select value={sessionId} onValueChange={(value) => setSessionId(value as string)}>
              <SelectTrigger className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {session && (
            <div className="rounded-lg border border-border bg-white p-5">
              <div className="mb-3">
                <h3 className="text-base text-foreground">{session.title}</h3>
                <p className="text-xs text-muted-foreground">{session.dateLabel}</p>
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
                                disabled={savingKey === key}
                                onClick={() => updateStatus(row.studentId, s)}
                                className={cn(
                                  "rounded-sm border px-2 py-0.75 text-[11px] font-medium transition-colors",
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
