"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { respondToRosterInvite, requestToJoinInstitute, searchInstitutes } from "@/lib/dashboard/institute-actions";
import type { BatchRosterEntry } from "@/components/dashboard/teacher/classes-tab";

/** One institute this teacher has ever been linked to, either direction —
 * an institute-sent invite awaiting this teacher's reply, or a teacher-sent
 * request awaiting the institute's (0121). */
export type TeacherInstituteLinkRow = {
  classId: string;
  instituteName: string;
  status: "pending" | "accepted" | "declined";
  requestedBy: "institute" | "teacher";
  dateLabel: string;
};

/**
 * A class an institute has assigned this teacher to teach — deliberately a
 * much lighter shape than TeacherBatchRow (moved here from classes-tab,
 * which only ever showed this list flat; grouping it under each institute's
 * own card reads more clearly now that a teacher can be linked to more than
 * one). The institute owns the batch (title, schedule, mode); a linked
 * teacher manages its content, not the batch record itself, so there's no
 * edit/delete here, just enough to orient them: which class, how it runs,
 * who's in it.
 */
export type InstituteTaughtBatchRow = {
  id: string;
  title: string;
  classId: string;
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  studentCount: number;
};

const panelClass = "rounded-lg border border-border bg-white p-5";

export function InstituteTab({
  links,
  taughtBatches,
  rosterByBatch,
}: {
  links: TeacherInstituteLinkRow[];
  taughtBatches: InstituteTaughtBatchRow[];
  rosterByBatch: Record<string, BatchRosterEntry[]>;
}) {
  const t = useTranslations("teacherDashboard.institute");
  const tClasses = useTranslations("teacherDashboard.classes");

  const [statusOverrides, setStatusOverrides] = useState<Partial<Record<string, "accepted" | "declined">>>({});
  const [respondingClassId, setRespondingClassId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRespond(classId: string, accept: boolean) {
    setRespondingClassId(classId);
    setError(null);
    const result = await respondToRosterInvite(classId, accept);
    setRespondingClassId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatusOverrides((prev) => ({ ...prev, [classId]: accept ? "accepted" : "declined" }));
  }

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ id: string; name: string; location: string | null }[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [requestingId, setRequestingId] = useState<string | null>(null);

  const linkedClassIds = new Set(links.map((link) => link.classId));

  async function handleSearch() {
    setSearching(true);
    setSearchError(null);
    const results = await searchInstitutes(searchQuery);
    setSearching(false);
    setSearchResults(results.filter((r) => !linkedClassIds.has(r.id)));
  }

  async function handleRequest(classId: string) {
    setRequestingId(classId);
    setSearchError(null);
    const result = await requestToJoinInstitute(classId);
    setRequestingId(null);
    if (result.error) {
      setSearchError(result.error);
      return;
    }
    setRequestedIds((prev) => new Set(prev).add(classId));
  }

  const batchesByClassId = new Map<string, InstituteTaughtBatchRow[]>();
  for (const batch of taughtBatches) {
    const list = batchesByClassId.get(batch.classId) ?? [];
    list.push(batch);
    batchesByClassId.set(batch.classId, list);
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {error && <p className="text-sm font-medium text-destructive">{error}</p>}

      <div className={panelClass}>
        <h3 className="mb-1 text-lg">{t("findHeading")}</h3>
        <p className="mb-3 text-sm text-muted-foreground">{t("findSubtitle")}</p>
        <div className="flex flex-wrap gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={t("findPlaceholder")}
            className="w-full sm:w-64"
          />
          <Button type="button" variant="outline" size="sm" onClick={handleSearch} disabled={searching || searchQuery.trim().length < 2}>
            {t("findSearch")}
          </Button>
          <Link href={{ pathname: "/teachers", query: { category: "class" } }}>
            <Button type="button" variant="ghost" size="sm">
              {t("emptyAction")}
            </Button>
          </Link>
        </div>
        {searchError && <p className="mt-2 text-sm font-medium text-destructive">{searchError}</p>}
        {searchResults.length > 0 && (
          <div className="mt-4 flex flex-col divide-y divide-border">
            {searchResults.map((institute) => (
              <div key={institute.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-foreground">{institute.name}</p>
                  {institute.location && <p className="text-sm text-muted-foreground">{institute.location}</p>}
                </div>
                {requestedIds.has(institute.id) ? (
                  <span className="text-sm font-medium text-success">{t("findRequested")}</span>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleRequest(institute.id)}
                    disabled={requestingId === institute.id}
                  >
                    {t("findRequest")}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {links.length === 0 ? (
        <div className={panelClass}>
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {links.map((link) => {
            const status = statusOverrides[link.classId] ?? link.status;
            const batches = batchesByClassId.get(link.classId) ?? [];
            return (
              <div key={link.classId} className={panelClass}>
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg text-foreground">{link.instituteName}</h3>
                    <p className="mt-0.5 text-sm text-muted-foreground">{link.dateLabel}</p>
                  </div>

                  {status === "accepted" && (
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                      {t("statusAccepted")}
                    </span>
                  )}
                  {status === "declined" && (
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                      {t("statusDeclined")}
                    </span>
                  )}
                  {status === "pending" && link.requestedBy === "institute" && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleRespond(link.classId, true)}
                        disabled={respondingClassId === link.classId}
                      >
                        {t("accept")}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleRespond(link.classId, false)}
                        disabled={respondingClassId === link.classId}
                      >
                        {t("decline")}
                      </Button>
                    </div>
                  )}
                  {status === "pending" && link.requestedBy === "teacher" && (
                    <span className="rounded-full bg-background px-2.5 py-1 text-xs text-muted-foreground">
                      {t("pendingFromTeacher")}
                    </span>
                  )}
                </div>

                {status === "pending" && link.requestedBy === "institute" && (
                  <p className="text-sm text-muted-foreground">{t("pendingFromInstitute")}</p>
                )}

                {status === "accepted" && batches.length > 0 && (
                  <div className="flex flex-col gap-4">
                    {batches.map((batch) => {
                      const roster = rosterByBatch[batch.id] ?? [];
                      return (
                        <div key={batch.id} className="rounded-lg border border-border bg-background p-4">
                          <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <h4 className="text-foreground">{batch.title}</h4>
                              <p className="mt-0.5 text-sm text-muted-foreground">
                                {batch.mode === "online" ? tClasses("form.modeOnline") : tClasses("form.modePhysical")}
                                {batch.location ? ` · ${batch.location}` : ""}
                                {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                              </p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 font-mono text-[11px] text-muted-foreground">
                              {tClasses("studentCount", { count: batch.studentCount })}
                            </span>
                          </div>

                          {roster.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{tClasses("noStudents")}</p>
                          ) : (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>{tClasses("columns.student")}</TableHead>
                                  <TableHead>{tClasses("columns.joined")}</TableHead>
                                  <TableHead>{tClasses("columns.contact")}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {roster.map((student, i) => (
                                  <TableRow key={`${batch.id}-${i}`}>
                                    <TableCell className="font-medium text-foreground">{student.name}</TableCell>
                                    <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                                    <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
