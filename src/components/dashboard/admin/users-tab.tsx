"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { setUserSuspended, setInstitutionVerified } from "@/lib/dashboard/admin-actions";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import type { PlatformUser, PlatformUserRole } from "@/types/dashboard-admin";

type RoleFilter = "all" | PlatformUserRole;

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
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      return matchesSearch && matchesRole;
    });
  }, [users, search, role]);

  async function toggleUserStatus(user: PlatformUser) {
    const suspended = user.status !== "active";
    if (suspended && !window.confirm(t("confirmSuspend", { name: user.name }))) return;

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

  async function toggleInstitutionVerified(user: PlatformUser) {
    const verified = !user.institutionVerified;
    setPendingId(user.id);
    setError(null);
    const result = await setInstitutionVerified({ teacherId: user.id, verified });
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, institutionVerified: verified } : u)));
    refresh();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
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
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="sm:max-w-xs"
        />
        <Select value={role} onValueChange={(value) => setRole(value as RoleFilter)}>
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
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.user")}</TableHead>
              <TableHead>{t("columns.role")}</TableHead>
              <TableHead>{t("columns.joined")}</TableHead>
              <TableHead>{t("columns.status")}</TableHead>
              <TableHead className="text-right">{t("columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar>
                      <AvatarFallback className={avatarGradientClass(user.name)}>
                        {initialsFor(user.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{user.name}</span>
                    {user.institutionVerified && (
                      <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("institutionVerified")} />
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{roleLabels[user.role]}</TableCell>
                <TableCell className="text-muted-foreground">{user.joinedAt}</TableCell>
                <TableCell>
                  <StatusBadge variant={user.status === "active" ? "active" : "suspended"}>
                    {user.status === "active" ? t("status.active") : t("status.suspended")}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-2">
                    {user.role === "campus_lecturer" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleInstitutionVerified(user)}
                        disabled={pendingId === user.id}
                      >
                        {user.institutionVerified ? t("actions.unverify") : t("actions.verify")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleUserStatus(user)}
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
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  {t("empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
