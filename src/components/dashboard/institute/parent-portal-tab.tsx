"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { upsertGuardianContact } from "@/lib/dashboard/parent-portal-actions";

export type ParentPortalStudentRow = {
  studentId: string;
  studentName: string;
  guardianName: string;
  guardianPhone: string;
  guardianEmail: string;
  note: string;
};

export function ParentPortalTab({ students }: { students: ParentPortalStudentRow[] }) {
  const t = useTranslations("instituteDashboard.parentPortal");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      {students.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="flex flex-col gap-3">
          {students.map((s) => (
            <GuardianRow key={s.studentId} student={s} />
          ))}
        </div>
      )}
    </div>
  );
}

function GuardianRow({ student }: { student: ParentPortalStudentRow }) {
  const t = useTranslations("instituteDashboard.parentPortal");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh } = useDashboardRefresh();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(student.guardianName);
  const [phone, setPhone] = useState(student.guardianPhone);
  const [email, setEmail] = useState(student.guardianEmail);
  const [note, setNote] = useState(student.note);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result = await upsertGuardianContact({
      studentId: student.studentId,
      guardianName: name,
      guardianPhone: phone,
      guardianEmail: email,
      note,
    });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setEditing(false);
    refresh();
  }

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{student.studentName}</p>
          {!editing && (
            <div className="mt-1 flex flex-col gap-0.5 text-sm text-muted-foreground">
              <span>{student.guardianName || t("noContact")}</span>
              {student.guardianPhone && (
                <a href={`tel:${student.guardianPhone}`} className="text-accent-deep hover:underline">
                  {student.guardianPhone}
                </a>
              )}
              {student.guardianEmail && (
                <a href={`mailto:${student.guardianEmail}`} className="text-accent-deep hover:underline">
                  {student.guardianEmail}
                </a>
              )}
              {student.note && <span className="text-xs">{student.note}</span>}
            </div>
          )}
        </div>
        {!editing && (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
            {t("edit")}
          </Button>
        )}
      </div>
      {editing && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>{t("guardianName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("guardianPhone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("guardianEmail")}</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("note")}</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <p className="text-sm font-medium text-destructive sm:col-span-2">{error}</p>}
          <div className="flex gap-3 sm:col-span-2">
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              {tc("save")}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              {tc("cancel")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
