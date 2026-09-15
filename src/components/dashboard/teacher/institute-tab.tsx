"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { avatarGradientClass } from "@/lib/avatar-color";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { respondToRosterInvite, requestToJoinInstitute, searchInstitutes } from "@/lib/dashboard/institute-actions";
import {
  createTeacherSeekingAd,
  setTeacherSeekingAdStatus,
  deleteTeacherSeekingAd,
  respondToTeacherSeekingAdDecision,
} from "@/lib/dashboard/teacher-seeking-ads-actions";
import { applyToVacancy } from "@/lib/dashboard/vacancy-ads-actions";
import type { BatchRosterEntry } from "@/components/dashboard/teacher/classes-tab";
import type { GradeBand } from "@/types/grade-band";
import { GRADE_BAND_SELECT_VALUES, OPEN_GRADE_VALUE } from "@/lib/grade-band-options";

/** One institute this teacher has ever been linked to, either direction —
 * an institute-sent invite awaiting this teacher's reply, or a teacher-sent
 * request awaiting the institute's (0121). */
export type TeacherInstituteLinkRow = {
  classId: string;
  instituteName: string;
  photoUrl: string | null;
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
  mode: "online" | "physical" | "travels_to_student";
  location: string | null;
  scheduleNote: string | null;
  studentCount: number;
};

/** A teacher's own "I'm available to join an institute" post (0136) — the
 * supply-side mirror of a student's wanted ad, and institutes browse/respond
 * to these the same way teachers/institutes browse wanted ads. */
export type TeacherSeekingAdRow = {
  id: string;
  subject: string | null;
  mode: "online" | "physical" | "travels_to_student" | null;
  gradeBand: string | null;
  title: string;
  content: string;
  active: boolean;
  createdLabel: string;
};

/** One institute's reply to one of this teacher's seeking ads (0137). */
export type TeacherSeekingAdResponseRow = {
  id: string;
  teacherSeekingAdId: string;
  instituteName: string;
  message: string;
  status: "new" | "read" | "accepted" | "declined";
  createdLabel: string;
};

/** An institute's "we're hiring" post (0141), browsable here the same way
 * institutes browse a teacher's own seeking ad (the reverse direction). */
export type VacancyAdRow = {
  id: string;
  instituteName: string | null;
  photoUrl: string | null;
  institutionVerified: boolean;
  subject: string | null;
  mode: "online" | "physical" | null;
  location: string | null;
  title: string;
  content: string;
  createdLabel: string;
  myApplication: string | null;
  myApplicationStatus: "new" | "read" | "accepted" | "declined" | null;
};

const panelClass = "rounded-lg border border-border bg-white p-5";

export function InstituteTab({
  links,
  taughtBatches,
  rosterByBatch,
  seekingAds,
  seekingAdResponses,
  subjectOptions,
  vacancies,
}: {
  links: TeacherInstituteLinkRow[];
  taughtBatches: InstituteTaughtBatchRow[];
  rosterByBatch: Record<string, BatchRosterEntry[]>;
  seekingAds: TeacherSeekingAdRow[];
  seekingAdResponses: TeacherSeekingAdResponseRow[];
  subjectOptions: { id: string; name: string }[];
  vacancies: VacancyAdRow[];
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

      <SeekingAdSection ads={seekingAds} responses={seekingAdResponses} subjectOptions={subjectOptions} />

      <VacancyBrowsePanel vacancies={vacancies} />

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
                  <div className="flex items-center gap-3">
                    <Avatar>
                      {link.photoUrl && <AvatarImage src={link.photoUrl} alt="" />}
                      <AvatarFallback className={avatarGradientClass(link.instituteName)}>
                        {link.instituteName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-lg text-foreground">{link.instituteName}</h3>
                      <p className="mt-0.5 text-sm text-muted-foreground">{link.dateLabel}</p>
                    </div>
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
                                {batch.mode === "online"
                                  ? tClasses("form.modeOnline")
                                  : batch.mode === "travels_to_student"
                                    ? tClasses("form.modeTravelsToStudent")
                                    : tClasses("form.modePhysical")}
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

/**
 * "Institute-Seeking Ad" (Gehan's mockup, section 2.2) — the supply-side
 * mirror of a student's wanted ad: instead of searching institutes one by
 * one (the panel above), a teacher posts once and institutes come find
 * them via list_teacher_seeking_ads_for_institutes (0137). Kept in this
 * same tab rather than a new top-level nav item — this is just a third way
 * to connect with an institute, alongside invites and search+request.
 */
function SeekingAdSection({
  ads,
  responses,
  subjectOptions,
}: {
  ads: TeacherSeekingAdRow[];
  responses: TeacherSeekingAdResponseRow[];
  subjectOptions: { id: string; name: string }[];
}) {
  const t = useTranslations("teacherDashboard.institute.seekingAd");
  const tg = useTranslations("search");
  const { refresh } = useDashboardRefresh();

  const [showForm, setShowForm] = useState(false);
  const [subjectId, setSubjectId] = useState(subjectOptions[0]?.id ?? "");
  const [mode, setMode] = useState<"online" | "physical" | "travels_to_student">("physical");
  const [gradeBand, setGradeBand] = useState<GradeBand | typeof OPEN_GRADE_VALUE>(OPEN_GRADE_VALUE);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const [statusOverrides, setStatusOverrides] = useState<Record<string, boolean>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  function modeLabel(m: "online" | "physical" | "travels_to_student" | null) {
    if (m === "online") return t("modeOnline");
    if (m === "travels_to_student") return t("modeTravelsToStudent");
    return t("modePhysical");
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setMode("physical");
    setGradeBand(OPEN_GRADE_VALUE);
    setSubjectId(subjectOptions[0]?.id ?? "");
  }

  async function handleCreate() {
    setCreating(true);
    setCreateError(null);
    const result = await createTeacherSeekingAd({
      subjectId,
      mode,
      gradeBand: gradeBand === OPEN_GRADE_VALUE ? "" : gradeBand,
      title,
      content,
    });
    setCreating(false);
    if (result.error) {
      setCreateError(result.error);
      return;
    }
    resetForm();
    setShowForm(false);
    refresh();
  }

  async function handleToggleActive(adId: string, active: boolean) {
    setBusyId(adId);
    setRowError(null);
    const result = await setTeacherSeekingAdStatus(adId, active);
    setBusyId(null);
    if (result.error) {
      setRowError({ id: adId, message: result.error });
      return;
    }
    setStatusOverrides((prev) => ({ ...prev, [adId]: active }));
    refresh();
  }

  async function handleDelete(adId: string) {
    setBusyId(adId);
    setRowError(null);
    const result = await deleteTeacherSeekingAd(adId);
    setBusyId(null);
    if (result.error) {
      setRowError({ id: adId, message: result.error });
      return;
    }
    setDeletedIds((prev) => new Set(prev).add(adId));
    refresh();
  }

  const visibleAds = ads.filter((ad) => !deletedIds.has(ad.id));

  return (
    <div className={panelClass}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg">{t("heading")}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {!showForm && (
          <Button type="button" size="sm" onClick={() => setShowForm(true)}>
            {t("postAd")}
          </Button>
        )}
      </div>

      {showForm &&
        (subjectOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noSubjects")}</p>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="seeking-ad-subject">{t("subjectLabel")}</Label>
                <Select value={subjectId} onValueChange={(value) => setSubjectId(value ?? "")}>
                  <SelectTrigger id="seeking-ad-subject" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {subjectOptions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="seeking-ad-mode">{t("modeLabel")}</Label>
                <Select value={mode} onValueChange={(value) => setMode(value as "online" | "physical" | "travels_to_student")}>
                  <SelectTrigger id="seeking-ad-mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="physical">{t("modePhysical")}</SelectItem>
                    <SelectItem value="online">{t("modeOnline")}</SelectItem>
                    <SelectItem value="travels_to_student">{t("modeTravelsToStudent")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="seeking-ad-grade">{t("gradeLabel")}</Label>
                <Select value={gradeBand} onValueChange={(value) => setGradeBand(value as GradeBand | typeof OPEN_GRADE_VALUE)}>
                  <SelectTrigger id="seeking-ad-grade" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GRADE_BAND_SELECT_VALUES.map((band) => (
                      <SelectItem key={band} value={band}>
                        {band === OPEN_GRADE_VALUE ? t("gradeAny") : tg(`grades.${band}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="seeking-ad-title">{t("titleLabel")}</Label>
                <Input id="seeking-ad-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="seeking-ad-content">{t("contentLabel")}</Label>
              <textarea
                id="seeking-ad-content"
                className="min-h-24 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={t("contentPlaceholder")}
              />
            </div>
            {createError && <p className="text-sm font-medium text-destructive">{createError}</p>}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={handleCreate}
                disabled={creating || title.trim().length < 2 || content.trim().length < 1}
              >
                {t("submit")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setShowForm(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ))}

      {visibleAds.length === 0 ? (
        !showForm && <p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {visibleAds.map((ad) => {
            const active = statusOverrides[ad.id] ?? ad.active;
            const adResponses = responses.filter((r) => r.teacherSeekingAdId === ad.id);
            return (
              <div key={ad.id} className="rounded-lg border border-border bg-background p-4">
                <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-foreground">{ad.title}</h4>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[ad.subject, modeLabel(ad.mode), ad.gradeBand ? tg(`grades.${ad.gradeBand}`) : null, ad.createdLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {active ? (
                      <StatusBadge variant="active">{t("statusActive")}</StatusBadge>
                    ) : (
                      <StatusBadge variant="closed">{t("statusClosed")}</StatusBadge>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/85">{ad.content}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleActive(ad.id, !active)}
                    disabled={busyId === ad.id}
                  >
                    {active ? t("pause") : t("resume")}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(ad.id)} disabled={busyId === ad.id}>
                    {t("delete")}
                  </Button>
                  {rowError?.id === ad.id && <span className="text-sm font-medium text-destructive">{rowError.message}</span>}
                </div>

                {adResponses.length > 0 && (
                  <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t("responsesHeading", { count: adResponses.length })}
                    </p>
                    {adResponses.map((response) => (
                      <SeekingAdResponseItem key={response.id} response={response} />
                    ))}
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

function SeekingAdResponseItem({ response }: { response: TeacherSeekingAdResponseRow }) {
  const t = useTranslations("teacherDashboard.institute.seekingAd");
  const { refresh } = useDashboardRefresh();
  const [deciding, setDeciding] = useState(false);
  const [status, setStatus] = useState(response.status);
  const [error, setError] = useState<string | null>(null);

  async function handleDecision(accepted: boolean) {
    setDeciding(true);
    setError(null);
    const result = await respondToTeacherSeekingAdDecision(response.id, accepted);
    setDeciding(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setStatus(accepted ? "accepted" : "declined");
    refresh();
  }

  const decided = status === "accepted" || status === "declined";

  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{response.instituteName}</span>
        <span className="text-xs text-muted-foreground">{response.createdLabel}</span>
      </div>
      <p className="text-sm text-foreground/85">{response.message}</p>
      {decided ? (
        <p className={`mt-1 text-xs font-medium ${status === "accepted" ? "text-success" : "text-destructive"}`}>
          {status === "accepted" ? t("responseAccepted") : t("responseDeclined")}
        </p>
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => handleDecision(true)} disabled={deciding}>
            {t("acceptResponse")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleDecision(false)} disabled={deciding}>
            {t("declineResponse")}
          </Button>
          {error && <span className="text-sm font-medium text-destructive">{error}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * "Vacancy Ad" (0141, mockup section 2.4) — the reverse direction of
 * SeekingAdSection above: here an institute posts an opening and this
 * teacher browses+applies, mirroring institute/teachers-tab.tsx's own
 * SeekingAdsBrowsePanel (which is the institute browsing a teacher's
 * seeking ad) for the opposite pairing.
 */
function VacancyBrowsePanel({ vacancies }: { vacancies: VacancyAdRow[] }) {
  const t = useTranslations("teacherDashboard.institute.vacancies");

  function modeLabel(m: "online" | "physical" | null) {
    if (m === "online") return t("modeOnline");
    return t("modePhysical");
  }

  return (
    <div className={panelClass}>
      <h3 className="mb-1 text-lg">{t("heading")}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
      {vacancies.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {vacancies.map((vacancy) => (
            <VacancyBrowseItem key={vacancy.id} vacancy={vacancy} modeLabel={modeLabel} />
          ))}
        </div>
      )}
    </div>
  );
}

function VacancyBrowseItem({
  vacancy,
  modeLabel,
}: {
  vacancy: VacancyAdRow;
  modeLabel: (m: "online" | "physical" | null) => string;
}) {
  const t = useTranslations("teacherDashboard.institute.vacancies");
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState("");
  const [myApplication, setMyApplication] = useState(vacancy.myApplication);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const result = await applyToVacancy(vacancy.id, message);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMyApplication(message);
    setApplying(false);
    setMessage("");
  }

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{vacancy.instituteName ?? "—"}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {vacancy.title}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{vacancy.createdLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {[vacancy.subject, modeLabel(vacancy.mode), vacancy.location].filter(Boolean).join(" · ")}
      </p>
      <p className="text-sm text-foreground/80">{vacancy.content}</p>

      {myApplication ? (
        <div className="mt-1 rounded-md bg-secondary/60 px-3 py-2">
          <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{t("yourApplication")}</p>
          <p className="text-sm text-foreground/85">{myApplication}</p>
          {vacancy.myApplicationStatus === "accepted" && (
            <p className="mt-1 text-xs font-medium text-success">{t("applicationStatusAccepted")}</p>
          )}
          {vacancy.myApplicationStatus === "declined" && (
            <p className="mt-1 text-xs font-medium text-destructive">{t("applicationStatusDeclined")}</p>
          )}
        </div>
      ) : applying ? (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("applicationPlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSend} disabled={sending || !message.trim()}>
              {t("sendApplication")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setApplying(false)}>
              {t("cancelApply")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setApplying(true)}>
            {t("apply")}
          </Button>
        </div>
      )}
    </div>
  );
}
