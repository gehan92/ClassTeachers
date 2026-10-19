"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, ChevronRight } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  setUserSuspended,
  setInstitutionVerified,
  getVerificationDocumentUrl,
  changeUserRole,
} from "@/lib/dashboard/admin-actions";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { usePagination } from "@/lib/hooks/use-pagination";
import { ExportButton, downloadCsv } from "@/components/dashboard/admin/reports/report-kit";
import { UserDetailSheet } from "@/components/dashboard/admin/user-detail-sheet";
import type { PlatformUser, PlatformUserRole } from "@/types/dashboard-admin";

type RoleFilter = "all" | PlatformUserRole;
type StatusFilter = "all" | "active" | "suspended" | "inactive" | "verificationWaiting";
const STATUS_FILTERS: StatusFilter[] = ["all", "active", "suspended", "inactive", "verificationWaiting"];
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
type DbRole = "student" | "teacher" | "campus_lecturer" | "class";

const DB_ROLE_BY_PLATFORM_ROLE: Record<PlatformUserRole, DbRole> = {
  student: "student",
  teacher: "teacher",
  campus_lecturer: "campus_lecturer",
  institute: "class",
};
const PLATFORM_ROLE_BY_DB_ROLE: Record<DbRole, PlatformUserRole> = {
  student: "student",
  teacher: "teacher",
  campus_lecturer: "campus_lecturer",
  class: "institute",
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

export function UsersTab({ initialUsers }: { initialUsers: PlatformUser[] }) {
  const t = useTranslations("adminDashboard.users");
  const tc = useTranslations("adminDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [users, setUsers] = useState<PlatformUser[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [detailUser, setDetailUser] = useState<PlatformUser | null>(null);
  // Fixed once per mount so the "inactive" filter doesn't call Date.now() during render.
  const [now] = useState(() => Date.now());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmSuspendUser, setConfirmSuspendUser] = useState<PlatformUser | null>(null);
  const [roleDialogUser, setRoleDialogUser] = useState<PlatformUser | null>(null);
  const [roleChoice, setRoleChoice] = useState<DbRole>("student");

  const roleLabels: Record<PlatformUserRole, string> = {
    teacher: t("roles.teacher"),
    institute: t("roles.institute"),
    student: t("roles.student"),
    campus_lecturer: t("roles.campusLecturer"),
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = query.length === 0 || user.name.toLowerCase().includes(query);
      const matchesRole = role === "all" || user.role === role;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && user.status === "active") ||
        (statusFilter === "suspended" && user.status === "suspended") ||
        (statusFilter === "inactive" && (!user.lastActiveIso || now - new Date(user.lastActiveIso).getTime() > THIRTY_DAYS)) ||
        (statusFilter === "verificationWaiting" && user.hasVerificationDocument === true && !user.institutionVerified);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, role, statusFilter, now]);

  function exportCsv() {
    downloadCsv(
      "classportals-users",
      [t("csv.name"), t("csv.role"), t("csv.status"), t("csv.joined"), t("csv.lastActive"), t("csv.verified")],
      filtered.map((u) => [
        u.name,
        roleLabels[u.role],
        u.status === "active" ? t("status.active") : t("status.suspended"),
        u.joinedAt,
        u.lastActive ?? t("never"),
        u.institutionVerified === undefined ? "" : u.institutionVerified ? t("csv.yes") : t("csv.no"),
      ]),
    );
  }

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filtered.length);
  const pagedUsers = filtered.slice(offset, offset + pageSize);

  function requestToggleUserStatus(user: PlatformUser) {
    // Suspending blocks sign-in, so it gets a confirmation; reactivating is
    // harmless and happens straight away.
    if (user.status === "active") {
      setConfirmSuspendUser(user);
      return;
    }
    void toggleUserStatus(user);
  }

  function openRoleDialog(user: PlatformUser) {
    setRoleDialogUser(user);
    setRoleChoice(DB_ROLE_BY_PLATFORM_ROLE[user.role]);
    setError(null);
  }

  async function handleChangeRole() {
    if (!roleDialogUser) return;
    const user = roleDialogUser;
    if (roleChoice === DB_ROLE_BY_PLATFORM_ROLE[user.role]) {
      setRoleDialogUser(null);
      return;
    }
    setPendingId(user.id);
    setError(null);
    const result = await changeUserRole({ userId: user.id, role: roleChoice });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRoleDialogUser(null);
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: PLATFORM_ROLE_BY_DB_ROLE[roleChoice] } : u)));
    refresh();
  }

  async function toggleUserStatus(user: PlatformUser) {
    const suspended = user.status === "active";
    setPendingId(user.id);
    setError(null);
    const result = await setUserSuspended({ userId: user.id, suspended });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUsers((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, status: suspended ? "suspended" : "active" } : u)),
    );
    refresh();
  }

  function ownerTypeFor(user: PlatformUser): "teacher" | "class" {
    return user.role === "institute" ? "class" : "teacher";
  }

  async function toggleInstitutionVerified(user: PlatformUser) {
    const verified = !user.institutionVerified;
    setPendingId(user.id);
    setError(null);
    const result = await setInstitutionVerified({ ownerType: ownerTypeFor(user), ownerId: user.id, verified });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, institutionVerified: verified } : u)));
    refresh();
  }

  async function viewDocument(user: PlatformUser) {
    setPendingId(user.id);
    setError(null);
    const result = await getVerificationDocumentUrl(ownerTypeFor(user), user.id);
    setPendingId(null);
    if (result.error || !result.url) {
      setError(result.error ?? t("documentUnavailable"));
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <ExportButton onClick={exportCsv} disabled={filtered.length === 0} />
      </div>

      {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
        className="mb-4"
      />

      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-xs"
        />
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value as RoleFilter);
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-48">
            <SelectValue placeholder={t("roleFilter.all")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("roleFilter.all")}</SelectItem>
            <SelectItem value="teacher">{t("roleFilter.teacher")}</SelectItem>
            <SelectItem value="institute">{t("roleFilter.institute")}</SelectItem>
            <SelectItem value="student">{t("roleFilter.student")}</SelectItem>
            <SelectItem value="campus_lecturer">{t("roleFilter.campusLecturer")}</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter((value as StatusFilter) ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger className="sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map((f) => (
              <SelectItem key={f} value={f}>
                {t(`statusFilter.${f}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-white p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.user")}</TableHead>
              <TableHead>{t("columns.role")}</TableHead>
              <TableHead>{t("columns.joined")}</TableHead>
              <TableHead>{t("columns.lastActive")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedUsers.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => setDetailUser(user)}
                    className="group flex items-center gap-2.5 rounded-md text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    title={t("openDetail")}
                  >
                    <Avatar>
                      <AvatarFallback className={avatarGradientClass(user.name)}>
                        {initialsFor(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground group-hover:text-primary group-hover:underline">{user.name}</span>
                    {user.institutionVerified && (
                      <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("institutionVerified")} />
                    )}
                    <ChevronRight className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">{roleLabels[user.role]}</TableCell>
                <TableCell className="text-muted-foreground">{user.joinedAt}</TableCell>
                <TableCell className="text-muted-foreground">{user.lastActive ?? t("never")}</TableCell>
                <TableCell>
                  <StatusBadge variant={user.status === "active" ? "active" : "suspended"}>
                    {user.status === "active" ? t("status.active") : t("status.suspended")}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-2">
                    {user.role !== "student" && user.hasVerificationDocument && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => viewDocument(user)}
                        disabled={pendingId === user.id}
                      >
                        {t("actions.viewDocument")}
                      </Button>
                    )}
                    {user.role !== "student" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleInstitutionVerified(user)}
                        disabled={pendingId === user.id || (!user.institutionVerified && !user.hasVerificationDocument)}
                        title={
                          !user.institutionVerified && !user.hasVerificationDocument
                            ? t("actions.verifyDisabledHint")
                            : undefined
                        }
                      >
                        {user.institutionVerified ? t("actions.unverify") : t("actions.verify")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openRoleDialog(user)}
                      disabled={pendingId === user.id}
                    >
                      {t("actions.changeRole")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className={user.status === "active" ? "text-destructive hover:text-destructive" : undefined}
                      onClick={() => requestToggleUserStatus(user)}
                      disabled={pendingId === user.id}
                    >
                      {user.status === "active" ? t("actions.manage") : t("actions.reactivate")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedUsers.length, total: filtered.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        )}
      </div>

      <UserDetailSheet user={detailUser} onClose={() => setDetailUser(null)} />

      <Dialog open={confirmSuspendUser !== null} onOpenChange={(open) => !open && setConfirmSuspendUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("suspendDialog.title")}</DialogTitle>
            <DialogDescription>
              {confirmSuspendUser ? t("confirmSuspend", { name: confirmSuspendUser.name }) : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmSuspendUser(null)}>
              {t("dialogCancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                const user = confirmSuspendUser;
                setConfirmSuspendUser(null);
                if (user) void toggleUserStatus(user);
              }}
            >
              {t("suspendDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={roleDialogUser !== null} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{roleDialogUser ? t("roleDialog.title", { name: roleDialogUser.name }) : ""}</DialogTitle>
            <DialogDescription>{t("roleDialog.description")}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="role-choice">{t("roleDialog.newRoleLabel")}</Label>
            <Select value={roleChoice} onValueChange={(v) => v && setRoleChoice(v as DbRole)}>
              <SelectTrigger id="role-choice" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="student">{t("roles.student")}</SelectItem>
                <SelectItem value="teacher">{t("roles.teacher")}</SelectItem>
                <SelectItem value="campus_lecturer">{t("roles.campusLecturer")}</SelectItem>
                <SelectItem value="class">{t("roles.institute")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            <li>{t("roleDialog.effectOnboarding")}</li>
            <li>{t("roleDialog.effectListing")}</li>
            <li>{t("roleDialog.effectNotify")}</li>
          </ul>
          {error && roleDialogUser && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRoleDialogUser(null)}>
              {t("dialogCancel")}
            </Button>
            <Button
              type="button"
              onClick={handleChangeRole}
              disabled={
                !roleDialogUser ||
                pendingId === roleDialogUser.id ||
                roleChoice === DB_ROLE_BY_PLATFORM_ROLE[roleDialogUser.role]
              }
            >
              {t("roleDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
