"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useLiveCall } from "@/components/dashboard/live-call-context";
import { markAttendance, dismissLiveClassReminder } from "@/lib/dashboard/live-classes-actions";

export type StudentLiveClassRow = {
  id: string;
  title: string;
  teacherName: string;
  scheduledAtIso: string;
  scheduledLabel: string;
  durationMinutes: number;
  mode: "online" | "physical";
  joinLink: string | null;
};

type LiveState = "not_open" | "starting_soon" | "live" | "ended";

function classState(row: StudentLiveClassRow, nowMs: number): LiveState {
  const start = new Date(row.scheduledAtIso).getTime();
  const end = start + row.durationMinutes * 60 * 1000;
  if (nowMs >= start && nowMs <= end) return "live";
  if (nowMs > end) return "ended";
  if (start - nowMs <= 15 * 60 * 1000) return "starting_soon";
  return "not_open";
}

export function LiveClassesTab({
  classes,
  studentName,
  reminderClassIds,
}: {
  classes: StudentLiveClassRow[];
  studentName: string;
  reminderClassIds: string[];
}) {
  const t = useTranslations("studentDashboard.live");
  const [now, setNow] = useState(() => Date.now());
  const [markedId, setMarkedId] = useState<string | null>(null);
  const [dismissedReminderIds, setDismissedReminderIds] = useState<Set<string>>(new Set());
  const { activeCall, startCall, restoreCall } = useLiveCall();

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  async function handleJoin(row: StudentLiveClassRow) {
    if (!row.joinLink) return;
    setMarkedId(row.id);
    startCall({
      liveClassId: row.id,
      title: row.title,
      subtitle: row.teacherName,
      roomUrl: row.joinLink,
      displayName: studentName,
    });
    await markAttendance({ liveClassId: row.id });
    // Joining is the whole point of the reminder — clear it so it doesn't
    // keep showing once they've actually gotten in.
    dismissReminder(row.id);
    setTimeout(() => setMarkedId((current) => (current === row.id ? null : current)), 2500);
  }

  function dismissReminder(liveClassId: string) {
    setDismissedReminderIds((prev) => new Set(prev).add(liveClassId));
    void dismissLiveClassReminder({ liveClassId });
  }

  const activeReminders = classes.filter(
    (c) => reminderClassIds.includes(c.id) && !dismissedReminderIds.has(c.id) && classState(c, now) !== "ended",
  );

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {activeReminders.length > 0 && (
        <div className="mb-5 flex flex-col gap-2">
          {activeReminders.map((row) => {
            const state = classState(row, now);
            const isThisCallActive = activeCall?.liveClassId === row.id;
            const isBlockedByOtherCall = !!activeCall && activeCall.liveClassId !== row.id;
            return (
              <div
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-success/30 bg-success/10 p-3.5"
              >
                <p className="text-sm text-foreground">{t("reminderBanner", { title: row.title, teacher: row.teacherName })}</p>
                <div className="flex items-center gap-2">
                  {state === "live" &&
                    row.joinLink &&
                    (isThisCallActive ? (
                      <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={restoreCall}>
                        {t("returnToCallAction")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="bg-success text-success-foreground hover:bg-success/90"
                        disabled={isBlockedByOtherCall}
                        title={isBlockedByOtherCall ? t("inOtherCallHint") : undefined}
                        onClick={() => handleJoin(row)}
                      >
                        {t("joinButton")}
                      </Button>
                    ))}
                  <Button size="sm" variant="ghost" onClick={() => dismissReminder(row.id)}>
                    {t("dismiss")}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-lg border border-border bg-white">
        {classes.length === 0 ? (
          <p className="p-5 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colTitle")}</TableHead>
                <TableHead>{t("colTeacher")}</TableHead>
                <TableHead>{t("colSchedule")}</TableHead>
                <TableHead>{t("colMode")}</TableHead>
                <TableHead className="text-right">{t("colAction")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((row) => (
                <LiveClassRow
                  key={row.id}
                  row={row}
                  state={classState(row, now)}
                  onJoin={handleJoin}
                  onReturn={restoreCall}
                  justMarked={markedId === row.id}
                  isThisCallActive={activeCall?.liveClassId === row.id}
                  isBlockedByOtherCall={!!activeCall && activeCall.liveClassId !== row.id}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function LiveClassRow({
  row,
  state,
  onJoin,
  onReturn,
  justMarked,
  isThisCallActive,
  isBlockedByOtherCall,
}: {
  row: StudentLiveClassRow;
  state: LiveState;
  onJoin: (row: StudentLiveClassRow) => void;
  onReturn: () => void;
  justMarked: boolean;
  isThisCallActive: boolean;
  isBlockedByOtherCall: boolean;
}) {
  const t = useTranslations("studentDashboard.live");

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-normal text-foreground">{row.title}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">{row.teacherName}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">{row.scheduledLabel}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">
        {row.mode === "online" ? t("modeOnline") : t("modePhysical")}
      </TableCell>
      <TableCell className="text-right">
        {state === "not_open" && <StatusBadge variant="pending">{t("stateNotOpen")}</StatusBadge>}
        {state === "starting_soon" && <StatusBadge variant="upcoming">{t("stateStartingSoon")}</StatusBadge>}
        {state === "ended" && <StatusBadge variant="active">{t("stateEnded")}</StatusBadge>}
        {state === "live" && row.joinLink && (
          <div className="flex items-center justify-end gap-2">
            {justMarked && <span className="text-xs font-medium text-success">{t("markedPresent")}</span>}
            {isThisCallActive ? (
              <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={onReturn}>
                {t("returnToCallAction")}
              </Button>
            ) : (
              <Button
                size="sm"
                className="bg-success text-success-foreground hover:bg-success/90"
                disabled={isBlockedByOtherCall}
                title={isBlockedByOtherCall ? t("inOtherCallHint") : undefined}
                onClick={() => onJoin(row)}
              >
                {t("joinButton")}
              </Button>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
