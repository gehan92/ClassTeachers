"use client";

import { useTranslations } from "next-intl";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { teacherBatches, enrolledStudents } from "@/lib/mock-data";

export function ClassesTab() {
  const t = useTranslations("teacherDashboard.classes");
  const tg = useTranslations("search");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-5">
        {teacherBatches.map((batch) => {
          const roster = enrolledStudents.filter((s) => s.batchId === batch.id);
          return (
            <div key={batch.id} className="rounded-lg border border-border bg-white p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-lg text-foreground">{batch.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {tg(`grades.${batch.gradeBand}`)} · {batch.scheduleLabel}
                  </p>
                </div>
                <span className="rounded-full bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                  {t("studentCount", { count: roster.length })}
                </span>
              </div>

              {roster.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noStudents")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("columns.student")}</TableHead>
                      <TableHead>{t("columns.joined")}</TableHead>
                      <TableHead>{t("columns.contact")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                        <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                        <TableCell className="text-muted-foreground">{student.phone}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
