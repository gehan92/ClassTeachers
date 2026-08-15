"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { StatusBadge } from "@/components/features/status-badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { avatarGradientClass } from "@/lib/avatar-color";
import { linkedTeachers } from "@/lib/mock-data/dashboard-institute";
import type { LinkedTeacher } from "@/types/dashboard-institute";

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function TeachersTab() {
  const t = useTranslations("instituteDashboard.teachers");
  const [teachers, setTeachers] = useState<LinkedTeacher[]>(linkedTeachers);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteContact, setInviteContact] = useState("");
  const [inviteSubject, setInviteSubject] = useState("");
  const [invited, setInvited] = useState(false);
  const [resentId, setResentId] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<Record<string, boolean>>(
    () =>
      Object.fromEntries(
        linkedTeachers.map((teacher) => [teacher.id, teacher.visibleOnInstitutePage]),
      ),
  );

  function handleSendInvite() {
    const contact = inviteContact.trim();
    const subject = inviteSubject.trim();
    if (!contact) return;

    const newTeacher: LinkedTeacher = {
      id: `t-invite-${Date.now()}`,
      name: contact,
      masked: false,
      subject: subject || "—",
      rateDisplay: "—",
      studentCount: 0,
      visibleOnInstitutePage: false,
      status: "invited",
      teacherHref: "#",
    };

    setTeachers((prev) => [...prev, newTeacher]);
    setInviteContact("");
    setInviteSubject("");
    setShowInviteForm(false);
    setInvited(true);
    setTimeout(() => setInvited(false), 2500);
  }

  function handleResend(id: string) {
    setResentId(id);
    setTimeout(() => setResentId((current) => (current === id ? null : current)), 2500);
  }

  function handleRemove(teacher: LinkedTeacher) {
    if (!window.confirm(t("confirmRemove", { name: teacher.name }))) return;
    setTeachers((prev) => prev.filter((item) => item.id !== teacher.id));
    setVisibility((prev) => {
      const next = { ...prev };
      delete next[teacher.id];
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {invited && <span className="text-sm font-medium text-success">{t("invited")}</span>}
          <Button onClick={() => setShowInviteForm(true)}>{t("inviteTeacher")}</Button>
        </div>
      </div>

      {showInviteForm && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-4 text-lg">{t("inviteForm.title")}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-contact">{t("inviteForm.emailOrPhoneLabel")}</Label>
              <Input
                id="invite-contact"
                placeholder={t("inviteForm.emailOrPhonePlaceholder")}
                value={inviteContact}
                onChange={(e) => setInviteContact(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="invite-subject">{t("inviteForm.subjectLabel")}</Label>
              <Input
                id="invite-subject"
                placeholder={t("inviteForm.subjectPlaceholder")}
                value={inviteSubject}
                onChange={(e) => setInviteSubject(e.target.value)}
              />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{t("inviteForm.helper")}</p>
          <div className="mt-4 flex gap-3">
            <Button onClick={handleSendInvite}>{t("inviteForm.submit")}</Button>
            <Button variant="outline" onClick={() => setShowInviteForm(false)}>
              {t("inviteForm.cancel")}
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
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
            {teachers.map((teacher) => {
              const isInvited = teacher.status === "invited";

              return (
                <TableRow key={teacher.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback
                          className={isInvited ? "bg-muted text-muted-foreground" : avatarGradientClass(teacher.name)}
                        >
                          {isInvited ? "?" : initialsFor(teacher.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{teacher.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{teacher.subject}</TableCell>
                  <TableCell className="text-muted-foreground">{isInvited ? "—" : teacher.rateDisplay}</TableCell>
                  <TableCell>{isInvited ? "—" : teacher.studentCount}</TableCell>
                  {isInvited ? (
                    <TableCell colSpan={2}>
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge variant="pending">{t("table.inviteSent")}</StatusBadge>
                        <div className="flex items-center gap-2">
                          {resentId === teacher.id && (
                            <span className="text-sm font-medium text-success">{t("table.resentConfirm")}</span>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => handleResend(teacher.id)}>
                            {t("table.resend")}
                          </Button>
                        </div>
                      </div>
                    </TableCell>
                  ) : (
                    <>
                      <TableCell>
                        <Switch
                          checked={visibility[teacher.id]}
                          onCheckedChange={(checked) =>
                            setVisibility((prev) => ({ ...prev, [teacher.id]: checked }))
                          }
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
                    </>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
