"use client";

import { useState } from "react";
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
import { studentLiveClasses, studentEnrollments, attendanceRecords, CURRENT_STUDENT } from "@/lib/mock-data";
import type { StudentLiveClass } from "@/types/dashboard-student";
import type { AttendanceRecord } from "@/types/attendance";

/** Static "today" label, matching the hardcoded convention used across the
 * other student-dashboard tabs (see notes-tab.tsx / reviews-tab.tsx). */
const TODAY_LABEL = "14 Aug 2026";

export function LiveClassesTab() {
  const t = useTranslations("studentDashboard.live");
  const [records, setRecords] = useState<AttendanceRecord[]>(attendanceRecords);
  const [markedId, setMarkedId] = useState<string | null>(null);

  function handleJoin(liveClass: StudentLiveClass) {
    // Only classes tied to a batch the student is enrolled in can be auto-marked present.
    const enrollment = studentEnrollments.find(
      (e) => e.batchId && e.targetName === liveClass.teacherName,
    );
    if (enrollment?.batchId) {
      const alreadyPresent = records.some(
        (r) =>
          r.batchId === enrollment.batchId &&
          r.studentId === CURRENT_STUDENT.id &&
          r.sessionLabel === liveClass.title,
      );
      if (!alreadyPresent) {
        setRecords((prev) => [
          ...prev,
          {
            id: `att-${Date.now()}`,
            batchId: enrollment.batchId!,
            sessionLabel: liveClass.title,
            date: TODAY_LABEL,
            studentId: CURRENT_STUDENT.id,
            studentName: CURRENT_STUDENT.name,
            status: "present",
          },
        ]);
      }
    }
    setMarkedId(liveClass.id);
    setTimeout(() => setMarkedId((current) => (current === liveClass.id ? null : current)), 2500);
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-white">
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
            {studentLiveClasses.map((liveClass) => (
              <LiveClassRow
                key={liveClass.id}
                liveClass={liveClass}
                onJoin={handleJoin}
                justMarked={markedId === liveClass.id}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function LiveClassRow({
  liveClass,
  onJoin,
  justMarked,
}: {
  liveClass: StudentLiveClass;
  onJoin: (liveClass: StudentLiveClass) => void;
  justMarked: boolean;
}) {
  const t = useTranslations("studentDashboard.live");

  return (
    <TableRow>
      <TableCell className="font-medium whitespace-normal text-foreground">{liveClass.title}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">{liveClass.teacherName}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">{liveClass.scheduledLabel}</TableCell>
      <TableCell className="whitespace-normal text-muted-foreground">
        {liveClass.mode === "online" ? t("modeOnline") : t("modePhysical")}
      </TableCell>
      <TableCell className="text-right">
        {liveClass.state === "not_open" && <StatusBadge variant="pending">{t("stateNotOpen")}</StatusBadge>}
        {liveClass.state === "starting_soon" && (
          <StatusBadge variant="upcoming">{t("stateStartingSoon")}</StatusBadge>
        )}
        {liveClass.state === "live" && liveClass.joinLink && (
          <div className="flex items-center justify-end gap-2">
            {justMarked && <span className="text-xs font-medium text-success">{t("markedPresent")}</span>}
            <Button
              size="sm"
              nativeButton={false}
              className="bg-success text-success-foreground hover:bg-success/90"
              render={<a href={liveClass.joinLink} target="_blank" rel="noopener noreferrer" />}
              onClick={() => onJoin(liveClass)}
            >
              {t("joinButton")}
            </Button>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}
