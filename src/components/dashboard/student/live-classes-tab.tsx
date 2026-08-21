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
import { markAttendance } from "@/lib/dashboard/live-classes-actions";

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

export function LiveClassesTab({ classes }: { classes: StudentLiveClassRow[] }) {
  const t = useTranslations("studentDashboard.live");
  const [now, setNow] = useState(() => Date.now());
  const [markedId, setMarkedId] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  async function handleJoin(row: StudentLiveClassRow) {
    setMarkedId(row.id);
    await markAttendance({ liveClassId: row.id });
    setTimeout(() => setMarkedId((current) => (current === row.id ? null : current)), 2500);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

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
                  justMarked={markedId === row.id}
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
  justMarked,
}: {
  row: StudentLiveClassRow;
  state: LiveState;
  onJoin: (row: StudentLiveClassRow) => void;
  justMarked: boolean;
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
            <Button
              size="sm"
              nativeButton={false}
              className="bg-success text-success-foreground hover:bg-success/90"
              render={<a href={row.joinLink} target="_blank" rel="noopener noreferrer" />}
              onClick={() => onJoin(row)}
            >
              {t("joinButton")}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
