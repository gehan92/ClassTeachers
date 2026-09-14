"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { StatCard } from "@/components/dashboard/stat-card";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { usePagination } from "@/lib/hooks/use-pagination";
import {
  inviteTeacherToRoster,
  removeTeacherFromRoster,
  setTeacherVisibility,
  respondToTeacherJoinRequest,
} from "@/lib/dashboard/institute-actions";
import { respondToTeacherSeekingAd } from "@/lib/dashboard/teacher-seeking-ads-actions";

export type InstituteTeacherRow = {
  id: string;
  name: string;
  subject: string;
  rateDisplay: string;
  studentCount: number;
  visible: boolean;
  teacherHref: string;
  rosterStatus: "pending" | "accepted" | "declined";
  /** Who created this link (0121) -- an institute-sent invite still waiting
   * on the teacher renders "Invite pending" with a cancel action; a
   * teacher-sent request waiting on the institute renders "Wants to join"
   * with Approve/Reject instead. */
  requestedBy: "institute" | "teacher";
  isCampusLecturer: boolean;
};

/** A teacher's "seeking an institute" post (0136), browsable here the same
 * way teachers/institutes browse students' wanted ads. */
export type TeacherSeekingAdBrowseRow = {
  id: string;
  teacherName: string | null;
  photoUrl: string | null;
  subject: string | null;
  gradeBand: string | null;
  mode: "online" | "physical" | "travels_to_student" | null;
  title: string;
  content: string;
  createdLabel: string;
  myResponse: string | null;
  myResponseStatus: "new" | "read" | "accepted" | "declined" | null;
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function TeachersTab({
  teachers,
  seekingAds,
}: {
  teachers: InstituteTeacherRow[];
  seekingAds: TeacherSeekingAdBrowseRow[];
}) {
  const t = useTranslations("instituteDashboard.teachers");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(teachers.map((teacher) => [teacher.id, teacher.visible])),
  );
  const pendingTeachers = teachers.filter((teacher) => teacher.rosterStatus === "pending");
  const rosterTeachers = teachers.filter((teacher) => teacher.rosterStatus !== "pending");
  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(rosterTeachers.length);
  const pagedTeachers = rosterTeachers.slice(offset, offset + pageSize);

  async function handleAdd() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const result = await inviteTeacherToRoster(trimmed);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEmail("");
    setShowAddForm(false);
    refresh();
  }

  async function handleRemove(teacher: InstituteTeacherRow) {
    if (!window.confirm(t("confirmRemove", { name: teacher.name }))) return;
    await removeTeacherFromRoster(teacher.id);
    refresh();
  }

  async function handleVisibilityChange(teacherId: string, checked: boolean) {
    setVisibility((prev) => ({ ...prev, [teacherId]: checked }));
    await setTeacherVisibility(teacherId, checked);
    refresh();
  }

  const [respondingId, setRespondingId] = useState<string | null>(null);

  async function handleRespond(teacherId: string, accept: boolean) {
    setRespondingId(teacherId);
    await respondToTeacherJoinRequest(teacherId, accept);
    setRespondingId(null);
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setShowAddForm(true)}>{t("addTeacher")}</Button>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {showAddForm && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("addForm.title")}</h3>
          <div className="grid gap-1.5 sm:max-w-100">
            <Label htmlFor="add-teacher-email">{t("addForm.emailLabel")}</Label>
            <Input
              id="add-teacher-email"
              type="email"
              placeholder={t("addForm.emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("addForm.helperInvite")}</p>
          {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleAdd} disabled={saving || !email.trim()}>
              {t("addForm.submit")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setError(null);
              }}
              disabled={saving}
            >
              {t("addForm.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3.5 sm:max-w-100">
        <StatCard label={t("stats.pending")} value={pendingTeachers.length} />
        <StatCard label={t("stats.approved")} value={rosterTeachers.filter((teacher) => teacher.rosterStatus === "accepted").length} />
      </div>

      {pendingTeachers.length > 0 && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("pendingTitle")}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.teacher")}</TableHead>
                <TableHead>{t("table.subject")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pendingTeachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback className={avatarGradientClass(teacher.name)}>
                          {initialsFor(teacher.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{teacher.name}</span>
                        <span className="w-fit rounded-full bg-background px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground">
                          {teacher.requestedBy === "teacher" ? t("table.requestPending") : t("table.invitePending")}
                        </span>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{teacher.subject || "—"}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-3">
                      {teacher.requestedBy === "teacher" ? (
                        <>
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline disabled:pointer-events-none disabled:opacity-60"
                            onClick={() => handleRespond(teacher.id, true)}
                            disabled={respondingId === teacher.id}
                          >
                            {t("table.approve")}
                          </button>
                          <button
                            type="button"
                            className="text-sm font-medium text-lock hover:underline disabled:pointer-events-none disabled:opacity-60"
                            onClick={() => handleRespond(teacher.id, false)}
                            disabled={respondingId === teacher.id}
                          >
                            {t("table.reject")}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          className="text-sm font-medium text-lock hover:underline"
                          onClick={() => handleRemove(teacher)}
                        >
                          {t("table.cancelInvite")}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("rosterTitle")}</h3>
        {rosterTeachers.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("table.teacher")}</TableHead>
                <TableHead>{t("table.subject")}</TableHead>
                <TableHead>{t("table.rate")}</TableHead>
                <TableHead>{t("table.students")}</TableHead>
                <TableHead>{t("table.visible")}</TableHead>
                <TableHead className="text-right">{t("table.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTeachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback className={avatarGradientClass(teacher.name)}>
                          {initialsFor(teacher.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{teacher.name}</span>
                        {teacher.isCampusLecturer && (
                          <span className="w-fit rounded-full border border-border bg-background px-2 py-0.5 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground">
                            {t("table.lecturerBadge")}
                          </span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{teacher.subject || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{teacher.rateDisplay}</TableCell>
                  <TableCell>{teacher.studentCount}</TableCell>
                  <TableCell>
                    {teacher.rosterStatus === "accepted" ? (
                      <Switch
                        checked={visibility[teacher.id] ?? teacher.visible}
                        onCheckedChange={(checked) => handleVisibilityChange(teacher.id, checked)}
                      />
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-3">
                      <Link href={teacher.teacherHref} className="text-sm font-medium text-primary hover:underline">
                        {t("table.view")}
                      </Link>
                      <button
                        type="button"
                        className="text-sm font-medium text-lock hover:underline"
                        onClick={() => handleRemove(teacher)}
                      >
                        {t("table.remove")}
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {rosterTeachers.length > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedTeachers.length, total: rosterTeachers.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        )}
      </div>

      <SeekingAdsBrowsePanel ads={seekingAds} />
    </div>
  );
}

/**
 * "Institute-Seeking Ad" (Gehan's mockup, section 2.2) — mirrors
 * wanted-ads-browse-tab.tsx's own shape (a teacher/institute browsing and
 * responding to a student's wanted ad), just for the reverse direction: a
 * teacher advertises availability, an institute browses and responds.
 */
function SeekingAdsBrowsePanel({ ads }: { ads: TeacherSeekingAdBrowseRow[] }) {
  const t = useTranslations("instituteDashboard.teachers.seekingAds");
  const tg = useTranslations("search");

  function modeLabel(m: "online" | "physical" | "travels_to_student" | null) {
    if (m === "online") return t("modeOnline");
    if (m === "travels_to_student") return t("modeTravelsToStudent");
    return t("modePhysical");
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-1 text-lg">{t("heading")}</h3>
      <p className="mb-3 text-sm text-muted-foreground">{t("subtitle")}</p>
      {ads.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {ads.map((ad) => (
            <SeekingAdBrowseItem key={ad.id} ad={ad} modeLabel={modeLabel} tg={tg} />
          ))}
        </div>
      )}
    </div>
  );
}

function SeekingAdBrowseItem({
  ad,
  modeLabel,
  tg,
}: {
  ad: TeacherSeekingAdBrowseRow;
  modeLabel: (m: "online" | "physical" | "travels_to_student" | null) => string;
  tg: (key: string) => string;
}) {
  const t = useTranslations("instituteDashboard.teachers.seekingAds");
  const [responding, setResponding] = useState(false);
  const [message, setMessage] = useState("");
  const [myResponse, setMyResponse] = useState(ad.myResponse);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const result = await respondToTeacherSeekingAd(ad.id, message);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMyResponse(message);
    setResponding(false);
    setMessage("");
  }

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{ad.teacherName ?? t("teacherFallback")}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {ad.title}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{ad.createdLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {[ad.subject, modeLabel(ad.mode), ad.gradeBand ? tg(`grades.${ad.gradeBand}`) : null].filter(Boolean).join(" · ")}
      </p>
      <p className="text-sm text-foreground/80">{ad.content}</p>

      {myResponse ? (
        <div className="mt-1 rounded-md bg-secondary/60 px-3 py-2">
          <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{t("yourResponse")}</p>
          <p className="text-sm text-foreground/85">{myResponse}</p>
          {ad.myResponseStatus === "accepted" && <p className="mt-1 text-xs font-medium text-success">{t("responseStatusAccepted")}</p>}
          {ad.myResponseStatus === "declined" && (
            <p className="mt-1 text-xs font-medium text-destructive">{t("responseStatusDeclined")}</p>
          )}
        </div>
      ) : responding ? (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("responsePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSend} disabled={sending || !message.trim()}>
              {t("sendResponse")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setResponding(false)}>
              {t("cancelReply")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setResponding(true)}>
            {t("respond")}
          </Button>
        </div>
      )}
    </div>
  );
}
