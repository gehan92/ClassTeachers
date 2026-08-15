"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { platformUsers } from "@/lib/mock-data";
import { avatarGradientClass } from "@/lib/avatar-color";
import type { PlatformUser, PlatformUserPlan, PlatformUserRole } from "@/types/dashboard-admin";

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

export function UsersTab() {
  const t = useTranslations("adminDashboard.users");
  const [users, setUsers] = useState<PlatformUser[]>(platformUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");

  const roleLabels: Record<PlatformUserRole, string> = {
    teacher: t("roles.teacher"),
    institute: t("roles.institute"),
    student: t("roles.student"),
    campus_lecturer: t("roles.campusLecturer"),
  };

  const planLabels: Record<Exclude<PlatformUserPlan, null>, string> = {
    free: t("plans.free"),
    standard: t("plans.standard"),
    premium: t("plans.premium"),
  };

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users.filter((user) => {
      const matchesSearch = query.length === 0 || user.name.toLowerCase().includes(query);
      const matchesRole = role === "all" || user.role === role;
      return matchesSearch && matchesRole;
    });
  }, [users, search, role]);

  function toggleUserStatus(id: string) {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id ? { ...user, status: user.status === "active" ? "suspended" : "active" } : user,
      ),
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

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
              <TableHead>{t("columns.plan")}</TableHead>
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
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{roleLabels[user.role]}</TableCell>
                <TableCell className="text-muted-foreground">{user.joinedAt}</TableCell>
                <TableCell className="text-muted-foreground">{user.plan ? planLabels[user.plan] : "—"}</TableCell>
                <TableCell>
                  <StatusBadge variant={user.status === "active" ? "active" : "suspended"}>
                    {user.status === "active" ? t("status.active") : t("status.suspended")}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button size="sm" variant="ghost" onClick={() => toggleUserStatus(user.id)}>
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
      </div>
    </div>
  );
}
