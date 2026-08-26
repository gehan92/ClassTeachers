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
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { addTeacherToRoster, removeTeacherFromRoster, setTeacherVisibility } from "@/lib/dashboard/institute-actions";

export type InstituteTeacherRow = {
  id: string;
  name: string;
  subject: string;
  rateDisplay: string;
  studentCount: number;
  visible: boolean;
  teacherHref: string;
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

export function TeachersTab({ teachers }: { teachers: InstituteTeacherRow[] }) {
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

  async function handleAdd() {
    const trimmed = email.trim();
    if (!trimmed) return;
    setSaving(true);
    setError(null);
    const result = await addTeacherToRoster(trimmed);
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
          <p className="mt-3 text-sm text-muted-foreground">{t("addForm.helper")}</p>
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

      <div className="rounded-lg border border-border bg-white p-5">
        {teachers.length === 0 ? (
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
              {teachers.map((teacher) => (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback className={avatarGradientClass(teacher.name)}>
                          {initialsFor(teacher.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{teacher.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{teacher.subject || "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{teacher.rateDisplay}</TableCell>
                  <TableCell>{teacher.studentCount}</TableCell>
                  <TableCell>
                    <Switch
                      checked={visibility[teacher.id] ?? teacher.visible}
                      onCheckedChange={(checked) => handleVisibilityChange(teacher.id, checked)}
                    />
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
      </div>
    </div>
  );
}
