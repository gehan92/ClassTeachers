"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Mail, MapPin, Phone, School } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/features/status-badge";
import { decideSchool } from "@/lib/dashboard/admin-actions";
import type { AdminSchool } from "@/types/dashboard-admin";

type Decision = "approved" | "rejected" | "suspended";

/**
 * Admin -> Approvals -> Schools (School Mode, 0166). Pending schools get a
 * full card with everything worth checking (census number, phone, who the
 * Principal is); every other school sits in a compact list where it can be
 * suspended or brought back.
 */
export function SchoolApprovalsSection({ schools, onChanged }: { schools: AdminSchool[]; onChanged: () => void }) {
  const t = useTranslations("adminDashboard.schools");
  const ts = useTranslations("school");
  const [overrides, setOverrides] = useState<Record<string, AdminSchool["status"]>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<{ school: AdminSchool; decision: Exclude<Decision, "approved"> } | null>(null);
  const [reason, setReason] = useState("");

  if (schools.length === 0) return null;

  const rows = schools.map((s) => (overrides[s.id] ? { ...s, status: overrides[s.id] } : s));
  const pending = rows.filter((s) => s.status === "pending");
  const others = rows.filter((s) => s.status !== "pending");

  async function decide(school: AdminSchool, decision: Decision, why?: string) {
    setBusyId(school.id);
    setError(null);
    const result = await decideSchool({ id: school.id, name: school.name, decision, reason: why });
    setBusyId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOverrides((prev) => ({ ...prev, [school.id]: decision }));
    setAsking(null);
    setReason("");
    onChanged();
  }

  const district = (key: string) => (ts.has(`districts.${key}`) ? ts(`districts.${key}`) : key);

  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg text-primary">
          <School className="size-5" />
          {t("title")}
        </h2>
        <span className="text-xs text-muted-foreground">{t("subtitle")}</span>
      </div>

      {error && !asking && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}

      {pending.length === 0 ? (
        <p className="rounded-lg border border-border bg-white px-5 py-6 text-center text-sm text-muted-foreground">{t("nonePending")}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {pending.map((school) => (
            <li key={school.id} className="flex flex-col rounded-lg border border-cta/40 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-lg break-words text-primary">{school.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {ts(`types.${school.schoolType}`)} · {ts("gradeRange", { from: school.gradeFrom, to: school.gradeTo })} ·{" "}
                    {school.mediums.map((m) => ts(`mediums.${m}`)).join(", ")}
                  </p>
                </div>
                <StatusBadge variant="pending">{t("status.pending")}</StatusBadge>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
                <Info label={t("principal")} value={school.principalName} />
                <Info label={t("registration")} value={school.registrationNumber ?? t("notGiven")} warn={!school.registrationNumber} />
                <Info label={t("district")} value={district(school.district)} icon={<MapPin className="size-3.5" />} />
                <Info label={t("phone")} value={school.contactPhone ?? "—"} icon={<Phone className="size-3.5" />} />
                <Info label={t("email")} value={school.contactEmail ?? "—"} icon={<Mail className="size-3.5" />} />
                <Info label={t("submitted")} value={school.submittedAt} />
              </dl>
              <p className="mt-4 text-xs leading-relaxed text-muted-foreground">{t("checkHint")}</p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-lock hover:text-lock"
                  disabled={busyId === school.id}
                  onClick={() => {
                    setError(null);
                    setReason("");
                    setAsking({ school, decision: "rejected" });
                  }}
                >
                  {t("reject")}
                </Button>
                <Button type="button" size="sm" disabled={busyId === school.id} onClick={() => decide(school, "approved")}>
                  {t("approve")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {others.length > 0 && (
        <details className="mt-4 rounded-lg border border-border bg-white">
          <summary className="cursor-pointer px-5 py-3 text-sm font-semibold text-foreground">{t("allSchools", { n: others.length })}</summary>
          <ul className="divide-y divide-border border-t border-border">
            {others.map((school) => (
              <li key={school.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium break-words text-foreground">{school.name}</span>
                    <StatusBadge variant={school.status === "approved" ? "active" : "suspended"}>{t(`status.${school.status}`)}</StatusBadge>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {school.principalName} · {district(school.district)}
                    {school.decisionReason ? ` · ${school.decisionReason}` : ""}
                  </span>
                </div>
                {school.status === "approved" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="self-start text-lock hover:text-lock sm:self-auto"
                    disabled={busyId === school.id}
                    onClick={() => {
                      setError(null);
                      setReason("");
                      setAsking({ school, decision: "suspended" });
                    }}
                  >
                    {t("suspend")}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="self-start sm:self-auto"
                    disabled={busyId === school.id}
                    onClick={() => decide(school, "approved")}
                  >
                    {t("reinstate")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </details>
      )}

      <Dialog open={asking !== null} onOpenChange={(open) => !open && setAsking(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{asking ? t(`${asking.decision}Dialog.title`, { name: asking.school.name }) : ""}</DialogTitle>
            <DialogDescription>{asking ? t(`${asking.decision}Dialog.description`) : ""}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="school-decision-reason">{t("reasonLabel")}</Label>
            <Textarea
              id="school-decision-reason"
              rows={4}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
            />
          </div>
          {error && asking && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAsking(null)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={!asking || busyId === asking.school.id || reason.trim().length < 5}
              onClick={() => asking && decide(asking.school, asking.decision, reason)}
            >
              {asking?.decision === "suspended" ? t("suspend") : t("reject")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function Info({ label, value, icon, warn }: { label: string; value: string; icon?: React.ReactNode; warn?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className={warn ? "m-0 flex items-center gap-1.5 text-accent-deep" : "m-0 flex items-center gap-1.5 break-words text-foreground"}>
        {icon}
        {value}
      </dd>
    </div>
  );
}
