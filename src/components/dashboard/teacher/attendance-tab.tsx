"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { attendanceRecords, teacherBatches } from "@/lib/mock-data";
import type { AttendanceRecord } from "@/types/attendance";
import { cn } from "@/lib/utils";

const STATUSES: AttendanceRecord["status"][] = ["present", "late", "absent"];

function statusVariant(status: AttendanceRecord["status"]) {
  if (status === "present") return "active" as const;
  if (status === "late") return "pending" as const;
  return "flagged" as const;
}

export function AttendanceTab() {
  const t = useTranslations("teacherDashboard.attendance");
  const [records, setRecords] = useState<AttendanceRecord[]>(attendanceRecords);
  const [batchId, setBatchId] = useState<string>(teacherBatches[0]?.id ?? "");

  const batchRecords = useMemo(() => records.filter((r) => r.batchId === batchId), [records, batchId]);

  const sessions = useMemo(() => {
    const map = new Map<string, { sessionLabel: string; date: string; rows: AttendanceRecord[] }>();
    for (const record of batchRecords) {
      const key = `${record.sessionLabel}__${record.date}`;
      if (!map.has(key)) {
        map.set(key, { sessionLabel: record.sessionLabel, date: record.date, rows: [] });
      }
      map.get(key)!.rows.push(record);
    }
    return Array.from(map.values());
  }, [batchRecords]);

  function updateStatus(id: string, status: AttendanceRecord["status"]) {
    setRecords((list) => list.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex items-center gap-2.5">
        <Select value={batchId} onValueChange={(value) => setBatchId(value as string)}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {teacherBatches.map((batch) => (
              <SelectItem key={batch.id} value={batch.id}>
                {batch.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5">
          <p className="text-sm text-muted-foreground">{t("noRecords")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {sessions.map((session) => (
            <div
              key={`${session.sessionLabel}-${session.date}`}
              className="rounded-lg border border-border bg-white p-5"
            >
              <div className="mb-3">
                <h3 className="text-base text-foreground">{session.sessionLabel}</h3>
                <p className="text-xs text-muted-foreground">{session.date}</p>
              </div>
              <div className="flex flex-col gap-2">
                {session.rows.map((record) => (
                  <div
                    key={record.id}
                    className="flex flex-wrap items-center justify-between gap-2.5 rounded-md border border-border p-3"
                  >
                    <span className="font-medium text-foreground">{record.studentName}</span>
                    <div className="flex items-center gap-2">
                      <StatusBadge variant={statusVariant(record.status)}>{t(`status.${record.status}`)}</StatusBadge>
                      <div className="flex gap-1">
                        {STATUSES.map((status) => (
                          <button
                            key={status}
                            type="button"
                            onClick={() => updateStatus(record.id, status)}
                            className={cn(
                              "rounded-sm border px-2 py-0.75 text-[11px] font-medium transition-colors",
                              record.status === status
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-white text-muted-foreground hover:bg-secondary",
                            )}
                          >
                            {t(`status.${status}`)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
