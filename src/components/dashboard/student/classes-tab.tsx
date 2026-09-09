"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, GraduationCap, Megaphone, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { requestToJoin, joinOpenBatch } from "@/lib/dashboard/batches-actions";
import { submitInquiry } from "@/lib/inquiries-actions";
import { LiveClassesTab, type StudentLiveClassRow } from "@/components/dashboard/student/live-classes-tab";
import { classState } from "@/lib/dashboard/live-class-state";
import { useLiveCall } from "@/components/dashboard/live-call-context";
import { ExamsTab, type StudentExamRow } from "@/components/dashboard/student/exams-tab";
import { AssignmentsTab, type StudentAssignmentRow } from "@/components/dashboard/student/assignments-tab";
import { NotesTab, type StudentNoteRow } from "@/components/dashboard/student/notes-tab";
import { TeacherQuickProfile } from "@/components/features/institute-teacher-quick-view";
import { InstituteQuickProfile } from "@/components/features/institute-quick-view";
import type { InstituteTeacherCard, InstituteQuickView } from "@/types/class-profile";
import type { NotificationRow } from "@/components/dashboard/notification-bell";

export type MyClassRow = {
  enrollmentId: string;
  ownerId: string;
  batchId: string | null;
  batchTitle: string | null;
  ownerName: string;
  ownerType: "teacher" | "class";
  mode: "online" | "physical" | null;
  scheduleNote: string | null;
  status: "pending" | "accepted" | "declined";
  /** Swaps this row's "Teacher"/"Class" badge and any join-flow wording to campus terminology (0076) — a mixed list can have both, so this is per-row, not page-level. */
  isCampusLecturer: boolean;
};

export type AvailableBatchRow = {
  id: string;
  title: string;
  ownerId: string;
  ownerName: string;
  ownerType: "teacher" | "class";
  mode: "online" | "physical";
  location: string | null;
  scheduleNote: string | null;
  isCampusLecturer: boolean;
  courseCode: string | null;
  /** Open-enrollment (0106) — joins instantly via joinOpenBatch instead of
   * requestToJoin's pending request. */
  isOpenEnrollment: boolean;
};

/** Same row shape a content row needs to be matched against one specific
 * enrolled class — every content type (notes/exams/assignments/live) already
 * carries these three fields. */
type Owned = { ownerId: string; ownerType: "teacher" | "class"; batchId: string | null };

function belongsToClass(row: Owned, target: MyClassRow) {
  return (
    row.ownerId === target.ownerId &&
    row.ownerType === target.ownerType &&
    (row.batchId === null || row.batchId === target.batchId)
  );
}

// A missed assignment/homework (never submitted, due time already passed)
// is closed, not "due" — nothing left to act on. Used both to keep it out
// of the My Classes due count and, in ClassWorkspace, to keep it out of the
// per-class Assignments/Homework sections entirely once it's missed — the
// flat top-level Coursework tab (scope="history") is where a missed item
// stays visible as a record, per Gehan's explicit split.
function isAssignmentMissed(row: StudentAssignmentRow, nowMs: number): boolean {
  return !row.submission && row.dueAtIso !== null && new Date(row.dueAtIso).getTime() < nowMs;
}

/**
 * Clickable avatar sitting next to the owner's name — opens the
 * credentials-only quick-view popup when one is available (it always should
 * be, for anyone actually joinable), falling back to the real profile page
 * link only if the lookup somehow comes up empty, so it's never a dead
 * click. Was originally paired with a separate "View profile" text link;
 * Gehan flagged the text link as redundant once the avatar did the same
 * job, so it's the only "view profile" affordance on these rows now.
 */
function OwnerAvatar({
  ownerType,
  ownerId,
  photoUrl,
  hasQuickView,
  onOpenQuickView,
}: {
  ownerType: "teacher" | "class";
  ownerId: string;
  photoUrl: string | null;
  hasQuickView: boolean;
  onOpenQuickView: () => void;
}) {
  const image = photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- signed/public Supabase Storage URL, not a local/optimizable asset
    <img src={photoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
  ) : (
    <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
      {ownerType === "teacher" ? (
        <GraduationCap className="size-5 text-secondary-foreground" />
      ) : (
        <School className="size-5 text-secondary-foreground" />
      )}
    </div>
  );

  if (hasQuickView) {
    return (
      <button type="button" onClick={onOpenQuickView} className="shrink-0 rounded-full">
        {image}
      </button>
    );
  }
  return (
    <Link href={`/${ownerType === "teacher" ? "teacher" : "class"}/${ownerId}`} className="shrink-0 rounded-full">
      {image}
    </Link>
  );
}

export function ClassesTab({
  myClasses,
  availableBatches,
  notes,
  shortNotes,
  pastPapers,
  exams,
  assignments,
  homework,
  liveClasses,
  reminderClassIds,
  studentName,
  studentEmail,
  teacherProfiles,
  instituteProfiles,
  notifications,
}: {
  myClasses: MyClassRow[];
  availableBatches: AvailableBatchRow[];
  notes: StudentNoteRow[];
  shortNotes: StudentNoteRow[];
  pastPapers: StudentNoteRow[];
  exams: StudentExamRow[];
  assignments: StudentAssignmentRow[];
  homework: StudentAssignmentRow[];
  liveClasses: StudentLiveClassRow[];
  reminderClassIds: string[];
  studentName: string;
  studentEmail: string;
  teacherProfiles: InstituteTeacherCard[];
  instituteProfiles: InstituteQuickView[];
  notifications: NotificationRow[];
}) {
  const t = useTranslations("studentDashboard.classes");
  const tc = useTranslations("studentDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openClassId, setOpenClassId] = useState<string | null>(null);
  const [forceOpenSection, setForceOpenSection] = useState<string | null>(null);
  const [quickViewTeacherId, setQuickViewTeacherId] = useState<string | null>(null);
  const [quickViewInstituteId, setQuickViewInstituteId] = useState<string | null>(null);

  // Ticking (not a one-time snapshot) so a card's "Live now" badge actually
  // turns on/off as a class starts and ends while this list is left open,
  // same 30s cadence LiveClassesTab already uses for the same reason.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const teacherProfileById = useMemo(() => new Map(teacherProfiles.map((p) => [p.id, p])), [teacherProfiles]);
  const instituteProfileById = useMemo(() => new Map(instituteProfiles.map((p) => [p.id, p])), [instituteProfiles]);
  const quickViewTeacher = quickViewTeacherId ? (teacherProfileById.get(quickViewTeacherId) ?? null) : null;
  const quickViewInstitute = quickViewInstituteId ? (instituteProfileById.get(quickViewInstituteId) ?? null) : null;

  function openQuickView(ownerType: "teacher" | "class", ownerId: string) {
    if (ownerType === "teacher") setQuickViewTeacherId(ownerId);
    else setQuickViewInstituteId(ownerId);
  }

  function getPhotoUrl(ownerType: "teacher" | "class", ownerId: string): string | null {
    if (ownerType === "teacher") return teacherProfileById.get(ownerId)?.photoUrl ?? null;
    return instituteProfileById.get(ownerId)?.photoUrl ?? null;
  }

  const NEW_ACTIVITY_TYPES = ["new_note", "new_exam", "new_assignment", "new_live_class", "live_class_started"];

  /** At-a-glance signals for one enrolled class's own card, so a student can
   * tell what needs attention before opening it — same underlying data
   * ClassWorkspace already computes per section, just rolled up to the
   * card level. "New activity" reuses the same unread-notification signal
   * the sidebar dots use (see hasNewLive et al. in page.tsx), matched to
   * this specific class via the ownerId/ownerType/batchId every relevant
   * notify() call now carries in its data payload. */
  function classStatsFor(classRow: MyClassRow) {
    const isLiveNow = liveClasses.some((lc) => belongsToClass(lc, classRow) && classState(lc, now) === "live");
    const dueSoonCount =
      exams.filter((e) => belongsToClass(e, classRow) && e.submission?.status !== "graded").length +
      assignments.filter(
        (a) => belongsToClass(a, classRow) && a.submission?.status !== "graded" && !isAssignmentMissed(a, now),
      ).length +
      homework.filter(
        (h) => belongsToClass(h, classRow) && h.submission?.status !== "graded" && !isAssignmentMissed(h, now),
      ).length;
    const hasNewActivity = notifications.some((n) => {
      if (n.readAt || !NEW_ACTIVITY_TYPES.includes(n.type)) return false;
      const data = n.data ?? {};
      return (
        data.ownerId === classRow.ownerId &&
        data.ownerType === classRow.ownerType &&
        (data.batchId === null || data.batchId === classRow.batchId)
      );
    });
    return { isLiveNow, dueSoonCount, hasNewActivity };
  }

  async function handleJoin(batchId: string, isOpenEnrollment: boolean) {
    setJoiningId(batchId);
    setError(null);
    const result = isOpenEnrollment ? await joinOpenBatch(batchId) : await requestToJoin(batchId);
    setJoiningId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    refresh();
  }

  const acceptedClasses = myClasses.filter((item) => item.status === "accepted");
  const openClass = openClassId ? (acceptedClasses.find((c) => c.enrollmentId === openClassId) ?? null) : null;

  // Landing here from a "class started"/"class ended" notification (see
  // dashboard-shell.tsx's select/navNonce) — the notification only carries a
  // liveClassId (it's broadcast to every enrolled student, so it can't carry
  // any one student's own enrollmentId), so this resolves it to the matching
  // class the same way ClassWorkspace already matches its own content: same
  // owner + batch. navNonce forces this component to remount on every such
  // navigation, even a repeat click while already on this tab, so reading
  // the URL once on mount is enough — no need to watch for later changes.
  useEffect(() => {
    const liveClassId = new URLSearchParams(window.location.search).get("liveClass");
    if (!liveClassId) return;
    const liveClass = liveClasses.find((row) => row.id === liveClassId);
    if (!liveClass) return;
    const match = acceptedClasses.find((c) => belongsToClass(liveClass, c));
    if (!match) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL, not derived render state
    setOpenClassId(match.enrollmentId);
    setForceOpenSection("live");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the URL once on mount only; this component remounts fresh for every notification-driven navigation here (see navNonce in dashboard-shell.tsx)
  }, []);

  return (
    <div>
      {openClass ? (
        <ClassWorkspace
          classRow={openClass}
          notes={notes}
          shortNotes={shortNotes}
          pastPapers={pastPapers}
          exams={exams}
          assignments={assignments}
          homework={homework}
          liveClasses={liveClasses}
          reminderClassIds={reminderClassIds}
          studentName={studentName}
          studentEmail={studentEmail}
          forceOpenSection={forceOpenSection}
          hasQuickView={
            openClass.ownerType === "teacher"
              ? teacherProfileById.has(openClass.ownerId)
              : instituteProfileById.has(openClass.ownerId)
          }
          photoUrl={getPhotoUrl(openClass.ownerType, openClass.ownerId)}
          onOpenQuickView={() => openQuickView(openClass.ownerType, openClass.ownerId)}
          onBack={() => {
            setOpenClassId(null);
            setForceOpenSection(null);
          }}
        />
      ) : (
        <>
          <div className="mb-5">
            <h1 className="mb-1 text-2xl">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          <RefreshStatus
            pending={isRefreshing}
            stuck={refreshStuck}
            pendingLabel={tc("updatingList")}
            stuckLabel={tc("updateStuck")}
            reloadLabel={tc("reloadPage")}
            className="mb-5"
          />

          {acceptedClasses.length === 0 ? (
            <div className="mb-8 rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              {t("emptyState")}
            </div>
          ) : (
            <div className="mb-8 flex flex-col gap-4">
              {acceptedClasses.map((item) => {
                const stats = classStatsFor(item);
                return (
                  <div
                    key={item.enrollmentId}
                    className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <OwnerAvatar
                        ownerType={item.ownerType}
                        ownerId={item.ownerId}
                        photoUrl={getPhotoUrl(item.ownerType, item.ownerId)}
                        hasQuickView={
                          item.ownerType === "teacher"
                            ? teacherProfileById.has(item.ownerId)
                            : instituteProfileById.has(item.ownerId)
                        }
                        onOpenQuickView={() => openQuickView(item.ownerType, item.ownerId)}
                      />
                      <div className="min-w-0">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-foreground">{item.ownerName}</span>
                          <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                            {item.ownerType === "teacher" ? t("typeTeacher") : t("typeClass")}
                          </span>
                          {stats.isLiveNow && (
                            <span className="flex items-center gap-1.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[11px] font-semibold text-destructive">
                              <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                              {t("liveNowBadge")}
                            </span>
                          )}
                          {stats.hasNewActivity && (
                            <span className="flex items-center gap-1.5 rounded-full bg-cta/10 px-2 py-0.5 text-[11px] font-semibold text-cta">
                              <span className="size-1.5 rounded-full bg-cta" />
                              {t("newActivityBadge")}
                            </span>
                          )}
                          {stats.dueSoonCount > 0 && (
                            <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-foreground">
                              {t("dueSoonBadge", { count: stats.dueSoonCount })}
                            </span>
                          )}
                        </div>
                        {item.batchTitle && <div className="text-sm text-muted-foreground">{item.batchTitle}</div>}
                        {item.scheduleNote && <div className="mt-1 text-xs text-muted-foreground">{item.scheduleNote}</div>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <Button size="sm" onClick={() => setOpenClassId(item.enrollmentId)}>
                        {t("openClass")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <h2 className="mb-3 text-lg font-semibold text-foreground">{t("browseTitle")}</h2>
          {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
          {availableBatches.length === 0 ? (
            <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">
              {t("browseEmpty")}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {availableBatches.map((batch) => (
                <div
                  key={batch.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-white p-4.5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <OwnerAvatar
                      ownerType={batch.ownerType}
                      ownerId={batch.ownerId}
                      photoUrl={getPhotoUrl(batch.ownerType, batch.ownerId)}
                      hasQuickView={
                        batch.ownerType === "teacher"
                          ? teacherProfileById.has(batch.ownerId)
                          : instituteProfileById.has(batch.ownerId)
                      }
                      onOpenQuickView={() => openQuickView(batch.ownerType, batch.ownerId)}
                    />
                    <div className="min-w-0">
                      <div className="mb-1 flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">{batch.ownerName}</span>
                        <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                          {batch.isCampusLecturer
                            ? t("typeCampusLecturer")
                            : batch.ownerType === "teacher"
                              ? t("typeTeacher")
                              : t("typeClass")}
                        </span>
                        {batch.isOpenEnrollment && (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">
                            {t("openEnrollmentBadge")}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {batch.courseCode && <span>{batch.courseCode} · </span>}
                        {batch.title}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {batch.mode === "online" ? t("modeOnline") : t("modePhysical")}
                        {batch.location ? ` · ${batch.location}` : ""}
                        {batch.scheduleNote ? ` · ${batch.scheduleNote}` : ""}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    disabled={joiningId === batch.id}
                    onClick={() => handleJoin(batch.id, batch.isOpenEnrollment)}
                    className="shrink-0"
                  >
                    {batch.isOpenEnrollment ? t("joinNow") : batch.isCampusLecturer ? t("requestToEnroll") : t("requestToJoin")}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={quickViewTeacher !== null} onOpenChange={(open) => !open && setQuickViewTeacherId(null)}>
        <DialogContent>{quickViewTeacher && <TeacherQuickProfile teacher={quickViewTeacher} />}</DialogContent>
      </Dialog>
      <Dialog open={quickViewInstitute !== null} onOpenChange={(open) => !open && setQuickViewInstituteId(null)}>
        <DialogContent>{quickViewInstitute && <InstituteQuickProfile institute={quickViewInstitute} />}</DialogContent>
      </Dialog>
    </div>
  );
}

/**
 * "Layer 2" — everything about one specific class in one place (notes, exams,
 * assignments, live sessions), reusing the exact same tab components the flat
 * "Layer 1" views render, just pre-filtered to this one owner+batch instead of
 * every class at once. See the Student Class Workspace analysis this was
 * built from. Content types carrying no batchId of their own (an owner-wide
 * note, say) still show here — belongsToClass treats an unscoped row as
 * visible from any of that owner's classes, matching how the flat tabs
 * already treat batch-less content.
 */
function ClassWorkspace({
  classRow,
  notes,
  shortNotes,
  pastPapers,
  exams,
  assignments,
  homework,
  liveClasses,
  reminderClassIds,
  studentName,
  studentEmail,
  forceOpenSection,
  hasQuickView,
  photoUrl,
  onOpenQuickView,
  onBack,
}: {
  classRow: MyClassRow;
  notes: StudentNoteRow[];
  shortNotes: StudentNoteRow[];
  pastPapers: StudentNoteRow[];
  exams: StudentExamRow[];
  assignments: StudentAssignmentRow[];
  homework: StudentAssignmentRow[];
  liveClasses: StudentLiveClassRow[];
  reminderClassIds: string[];
  studentName: string;
  studentEmail: string;
  /** Arriving from a "class started"/"class ended" notification forces this
   * section open regardless of whether it's actionable — e.g. an ended
   * class's Live Class section wouldn't normally auto-open since nothing's
   * left to do there, but the whole point of clicking that notification is
   * to land on exactly that section. */
  forceOpenSection?: string | null;
  hasQuickView: boolean;
  photoUrl: string | null;
  onOpenQuickView: () => void;
  onBack: () => void;
}) {
  const t = useTranslations("studentDashboard.classes");
  const tLive = useTranslations("studentDashboard.live");
  const tExams = useTranslations("studentDashboard.exams");
  const tAssignments = useTranslations("studentDashboard.assignments");
  const tHomework = useTranslations("studentDashboard.homework");
  const tNotes = useTranslations("studentDashboard.notes");
  const tShortNotes = useTranslations("studentDashboard.shortNotes");
  const tPastPapers = useTranslations("studentDashboard.pastPapers");

  // A snapshot, not a ticking clock — it only ever feeds the accordion's
  // uncontrolled defaultValue and the once-per-open missed-item filter
  // below, neither of which needs to be re-evaluated after mount.
  const [nowForDefaults] = useState(() => Date.now());

  // "Request Help" (student dashboard spec doc) -- a lightweight composer
  // right inside the class the question is actually about, reusing the same
  // submitInquiry action the public contact form already uses (name/contact
  // are already known here, so only the message itself needs typing). Once
  // sent, the thread lives in the student's own Messages/Inquiries tab like
  // any other inquiry -- this doesn't create a separate "help ticket" system.
  const [requestingHelp, setRequestingHelp] = useState(false);
  const [helpMessage, setHelpMessage] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [helpSent, setHelpSent] = useState(false);
  const [helpError, setHelpError] = useState<string | null>(null);

  async function handleSendHelp() {
    if (!helpMessage.trim()) return;
    setHelpSending(true);
    setHelpError(null);
    const result = await submitInquiry({
      ownerType: classRow.ownerType,
      ownerId: classRow.ownerId,
      name: studentName,
      contact: studentEmail,
      message: helpMessage,
    });
    setHelpSending(false);
    if (result.error) {
      setHelpError(result.error);
      return;
    }
    setHelpSent(true);
    setHelpMessage("");
    setRequestingHelp(false);
  }

  const classLiveClasses = useMemo(
    () => liveClasses.filter((row) => belongsToClass(row, classRow)),
    [liveClasses, classRow],
  );
  const classExams = useMemo(() => exams.filter((row) => belongsToClass(row, classRow)), [exams, classRow]);
  // A missed assignment/homework drops out of this per-class workspace
  // entirely — it's closed, nothing left to act on here, and it stays
  // visible as a record only in the flat top-level Coursework tab
  // (scope="history"), per Gehan's explicit split.
  const classAssignments = useMemo(
    () => assignments.filter((row) => belongsToClass(row, classRow) && !isAssignmentMissed(row, nowForDefaults)),
    [assignments, classRow, nowForDefaults],
  );
  const classHomework = useMemo(
    () => homework.filter((row) => belongsToClass(row, classRow) && !isAssignmentMissed(row, nowForDefaults)),
    [homework, classRow, nowForDefaults],
  );
  const classNotes = useMemo(() => notes.filter((row) => belongsToClass(row, classRow)), [notes, classRow]);
  const classShortNotes = useMemo(
    () => shortNotes.filter((row) => belongsToClass(row, classRow)),
    [shortNotes, classRow],
  );
  const classPastPapers = useMemo(
    () => pastPapers.filter((row) => belongsToClass(row, classRow)),
    [pastPapers, classRow],
  );

  // Surfaces what the teacher shares *during* a live session right where the
  // student can actually see it (the point of the floating mini-player is
  // that they're still watching the class while browsing other sections) —
  // otherwise it just sits quietly in its own accordion section until they
  // happen to open it. Only live while this class's own call is active, and
  // only content newer than the moment they joined it; it naturally empties
  // out once the call ends, since activeCall goes null then.
  const { activeCall } = useLiveCall();
  const activeClassCall =
    activeCall && classLiveClasses.some((lc) => lc.id === activeCall.liveClassId) ? activeCall : null;
  const justShared = useMemo(() => {
    if (!activeClassCall) return [];
    const joinedAt = activeClassCall.joinedAt;
    const isNew = (iso: string) => new Date(iso).getTime() > joinedAt;
    return [
      ...classExams.filter((row) => isNew(row.sharedAtIso)).map((row) => ({ type: tExams("title"), title: row.title })),
      ...classAssignments
        .filter((row) => isNew(row.createdAtIso))
        .map((row) => ({ type: tAssignments("title"), title: row.title })),
      ...classHomework
        .filter((row) => isNew(row.createdAtIso))
        .map((row) => ({ type: tHomework("title"), title: row.title })),
      ...classNotes.filter((row) => isNew(row.createdAtIso)).map((row) => ({ type: tNotes("title"), title: row.title })),
      ...classShortNotes
        .filter((row) => isNew(row.createdAtIso))
        .map((row) => ({ type: tShortNotes("title"), title: row.title })),
      ...classPastPapers
        .filter((row) => isNew(row.createdAtIso))
        .map((row) => ({ type: tPastPapers("title"), title: row.title })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the t* functions are stable per render and re-included on every render anyway; listing them would just churn this memo on every locale-unrelated re-render
  }, [activeClassCall, classExams, classAssignments, classHomework, classNotes, classShortNotes, classPastPapers]);

  // Sections open by default only when they hold something actionable —
  // an accordion where every section starts collapsed would hide exactly
  // the "something new happened" signal the sidebar's own unread dots are
  // trying to surface. Notes has no due/undue concept (view-only reference
  // material), so it always starts collapsed.
  const hasActionableLive = classLiveClasses.some(
    (lc) => new Date(lc.scheduledAtIso).getTime() + lc.durationMinutes * 60000 > nowForDefaults,
  );
  const hasActionableExams = classExams.some((exam) => exam.submission?.status !== "graded");
  const hasActionableAssignments = classAssignments.some(
    (assignment) => assignment.submission?.status !== "graded",
  );
  const hasActionableHomework = classHomework.some((item) => item.submission?.status !== "graded");
  const defaultOpenSections = Array.from(
    new Set(
      [
        hasActionableLive && "live",
        hasActionableExams && "exams",
        hasActionableAssignments && "assignments",
        hasActionableHomework && "homework",
        forceOpenSection,
      ].filter((value): value is string => Boolean(value)),
    ),
  );

  return (
    <div>
      <Button type="button" variant="ghost" size="sm" className="mb-4 h-auto p-0 font-medium text-primary hover:underline" onClick={onBack}>
        <ArrowLeft className="size-3.5" />
        {t("backToClasses")}
      </Button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white p-4.5">
        <div className="flex min-w-0 items-center gap-3">
          <OwnerAvatar
            ownerType={classRow.ownerType}
            ownerId={classRow.ownerId}
            photoUrl={photoUrl}
            hasQuickView={hasQuickView}
            onOpenQuickView={onOpenQuickView}
          />
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-foreground">{classRow.ownerName}</span>
              <span className="rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                {classRow.isCampusLecturer
                  ? t("typeCampusLecturer")
                  : classRow.ownerType === "teacher"
                    ? t("typeTeacher")
                    : t("typeClass")}
              </span>
            </div>
            {classRow.batchTitle && <div className="text-sm text-muted-foreground">{classRow.batchTitle}</div>}
            {classRow.scheduleNote && <div className="mt-1 text-xs text-muted-foreground">{classRow.scheduleNote}</div>}
          </div>
        </div>
        {!requestingHelp && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setRequestingHelp(true);
              setHelpSent(false);
            }}
          >
            {t("requestHelp.cta")}
          </Button>
        )}
      </div>

      {requestingHelp && (
        <div className="mb-6 rounded-lg border border-border bg-white p-4.5">
          <h4 className="mb-1 text-sm font-semibold text-foreground">{t("requestHelp.heading")}</h4>
          <p className="mb-3 text-xs text-muted-foreground">{t("requestHelp.hint")}</p>
          <textarea
            className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("requestHelp.placeholder")}
            value={helpMessage}
            onChange={(e) => setHelpMessage(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSendHelp} disabled={helpSending || !helpMessage.trim()}>
              {t("requestHelp.send")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setRequestingHelp(false)} disabled={helpSending}>
              {t("requestHelp.cancel")}
            </Button>
            {helpError && <span className="text-sm font-medium text-destructive">{helpError}</span>}
          </div>
        </div>
      )}

      {helpSent && (
        <div className="mb-6 rounded-lg border border-success/30 bg-success/10 p-3.5 text-sm text-success">
          {t("requestHelp.sentNote")}
        </div>
      )}

      {justShared.length > 0 && (
        <div className="mb-6 rounded-lg border border-cta/30 bg-cta/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Megaphone className="size-4 shrink-0 text-cta" />
            {t("justSharedHeading")}
          </div>
          <ul className="flex flex-col gap-1">
            {justShared.map((item, index) => (
              <li key={index} className="text-sm text-foreground">
                <span className="font-medium">{item.type}</span> — {item.title}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Accordion multiple defaultValue={defaultOpenSections} className="rounded-lg border border-border bg-white px-4.5">
        <AccordionItem value="live">
          <AccordionTrigger className="text-base font-semibold text-foreground">
            <span className="flex items-center gap-2">
              {tLive("title")}
              {hasActionableLive && <span className="size-1.5 shrink-0 rounded-full bg-cta" />}
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <LiveClassesTab
              classes={classLiveClasses}
              studentName={studentName}
              reminderClassIds={reminderClassIds}
              hideHeading
            />
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="exams">
          <AccordionTrigger className="text-base font-semibold text-foreground">
            <span className="flex items-center gap-2">
              {tExams("title")}
              {hasActionableExams && <span className="size-1.5 shrink-0 rounded-full bg-cta" />}
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <ExamsTab exams={classExams} hideHeading />
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="assignments">
          <AccordionTrigger className="text-base font-semibold text-foreground">
            <span className="flex items-center gap-2">
              {tAssignments("title")}
              {hasActionableAssignments && <span className="size-1.5 shrink-0 rounded-full bg-cta" />}
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <AssignmentsTab assignments={classAssignments} hideHeading />
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="homework">
          <AccordionTrigger className="text-base font-semibold text-foreground">
            <span className="flex items-center gap-2">
              {tHomework("title")}
              {hasActionableHomework && <span className="size-1.5 shrink-0 rounded-full bg-cta" />}
            </span>
          </AccordionTrigger>
          <AccordionPanel>
            <AssignmentsTab
              assignments={classHomework}
              hideHeading
              tNamespace="studentDashboard.homework"
            />
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="notes">
          <AccordionTrigger className="text-base font-semibold text-foreground">{tNotes("title")}</AccordionTrigger>
          <AccordionPanel>
            <NotesTab notes={classNotes} studentName={studentName} hideHeading />
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="shortNotes">
          <AccordionTrigger className="text-base font-semibold text-foreground">{tShortNotes("title")}</AccordionTrigger>
          <AccordionPanel>
            <NotesTab
              notes={classShortNotes}
              studentName={studentName}
              hideHeading
              tNamespace="studentDashboard.shortNotes"
            />
          </AccordionPanel>
        </AccordionItem>
        <AccordionItem value="pastPapers">
          <AccordionTrigger className="text-base font-semibold text-foreground">{tPastPapers("title")}</AccordionTrigger>
          <AccordionPanel>
            <NotesTab
              notes={classPastPapers}
              studentName={studentName}
              hideHeading
              tNamespace="studentDashboard.pastPapers"
            />
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
