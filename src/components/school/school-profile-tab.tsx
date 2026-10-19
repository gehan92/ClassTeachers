"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/school/native-select";
import { SchoolStatusCard } from "@/components/school/school-status-card";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { updateSchoolDetails } from "@/lib/school/actions";
import { SCHOOL_DISTRICTS, SCHOOL_GRADES, SCHOOL_MEDIUMS, SCHOOL_TYPES } from "@/lib/school/catalog";
import type { SchoolMedium, SchoolType } from "@/types/database";
import type { SchoolDetails } from "@/types/school";

type Draft = {
  name: string;
  schoolType: SchoolType;
  district: string;
  registrationNumber: string;
  gradeFrom: number;
  gradeTo: number;
  mediums: SchoolMedium[];
  contactPhone: string;
  contactEmail: string;
  website: string;
  address: string;
};

function draftFrom(school: SchoolDetails): Draft {
  return {
    name: school.name,
    schoolType: school.schoolType,
    district: school.district,
    registrationNumber: school.registrationNumber,
    gradeFrom: school.gradeFrom,
    gradeTo: school.gradeTo,
    mediums: school.mediums,
    contactPhone: school.contactPhone,
    contactEmail: school.contactEmail,
    website: school.website,
    address: school.address,
  };
}

/**
 * The school's own details — what the admin checked before approving.
 * Saving a rejected application sends it back for another look.
 */
export function SchoolProfileTab({ school, canEdit }: { school: SchoolDetails; canEdit: boolean }) {
  const t = useTranslations("school.profile");
  const ts = useTranslations("school");
  const tc = useTranslations("school.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(school));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const original = draftFrom(school);
  const dirty = JSON.stringify(draft) !== JSON.stringify(original);
  const editable = canEdit && school.status !== "suspended";
  const resubmit = school.status === "rejected";

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setSaved(null);
  }

  function toggleMedium(medium: SchoolMedium, on: boolean) {
    set(
      "mediums",
      on ? SCHOOL_MEDIUMS.filter((m) => m === medium || draft.mediums.includes(m)) : draft.mediums.filter((m) => m !== medium),
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (draft.mediums.length === 0) {
      setError(ts("errors.school_invalid_mediums"));
      return;
    }
    if (draft.gradeFrom > draft.gradeTo) {
      setError(ts("errors.school_invalid_grades"));
      return;
    }
    setSaving(true);
    setError(null);
    const result = await updateSchoolDetails({ schoolId: school.id, ...draft });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(result.status === "pending" && resubmit ? t("resubmitted") : t("saved"));
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <SchoolStatusCard school={school} showFixLink={false} />

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updating")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reload")}
      />

      <form onSubmit={save} className="rounded-xl border border-border bg-white">
        <fieldset disabled={!editable || saving} className="flex flex-col gap-0 divide-y divide-border">
          <FormSection title={t("sections.identity")} hint={t("sections.identityHint")}>
            <Field label={t("fields.name")} htmlFor="school-name">
              <Input id="school-name" value={draft.name} onChange={(e) => set("name", e.target.value)} required minLength={2} maxLength={160} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fields.type")} htmlFor="school-type">
                <NativeSelect id="school-type" value={draft.schoolType} onChange={(e) => set("schoolType", e.target.value as SchoolType)}>
                  {SCHOOL_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {ts(`types.${type}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t("fields.registration")} htmlFor="school-registration" hint={t("fields.registrationHint")}>
                <Input
                  id="school-registration"
                  value={draft.registrationNumber}
                  onChange={(e) => set("registrationNumber", e.target.value)}
                  maxLength={60}
                />
              </Field>
            </div>
          </FormSection>

          <FormSection title={t("sections.teaching")} hint={t("sections.teachingHint")}>
            <Field label={t("fields.grades")}>
              <div className="flex items-center gap-2">
                <NativeSelect
                  aria-label={t("fields.gradeFrom")}
                  value={draft.gradeFrom}
                  onChange={(e) => set("gradeFrom", Number(e.target.value))}
                >
                  {SCHOOL_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {ts("gradeN", { n: g })}
                    </option>
                  ))}
                </NativeSelect>
                <span className="shrink-0 text-sm text-muted-foreground">{t("to")}</span>
                <NativeSelect aria-label={t("fields.gradeTo")} value={draft.gradeTo} onChange={(e) => set("gradeTo", Number(e.target.value))}>
                  {SCHOOL_GRADES.map((g) => (
                    <option key={g} value={g}>
                      {ts("gradeN", { n: g })}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </Field>
            <Field label={t("fields.mediums")}>
              <div className="flex flex-wrap gap-x-5 gap-y-2">
                {SCHOOL_MEDIUMS.map((medium) => (
                  <label key={medium} className="flex cursor-pointer items-center gap-2 text-sm text-foreground/85">
                    <Checkbox checked={draft.mediums.includes(medium)} onCheckedChange={(v) => toggleMedium(medium, v === true)} />
                    {ts(`mediums.${medium}`)}
                  </label>
                ))}
              </div>
            </Field>
          </FormSection>

          <FormSection title={t("sections.contact")} hint={t("sections.contactHint")}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label={t("fields.district")} htmlFor="school-district">
                <NativeSelect id="school-district" value={draft.district} onChange={(e) => set("district", e.target.value)}>
                  {!(SCHOOL_DISTRICTS as readonly string[]).includes(draft.district) && <option value={draft.district}>{draft.district}</option>}
                  {SCHOOL_DISTRICTS.map((d) => (
                    <option key={d} value={d}>
                      {ts(`districts.${d}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label={t("fields.phone")} htmlFor="school-phone">
                <Input
                  id="school-phone"
                  type="tel"
                  value={draft.contactPhone}
                  onChange={(e) => set("contactPhone", e.target.value)}
                  required
                  minLength={7}
                  maxLength={30}
                />
              </Field>
              <Field label={t("fields.email")} htmlFor="school-email">
                <Input id="school-email" type="email" value={draft.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} maxLength={160} />
              </Field>
              <Field label={t("fields.website")} htmlFor="school-website">
                <Input
                  id="school-website"
                  value={draft.website}
                  onChange={(e) => set("website", e.target.value)}
                  placeholder="www.example.lk"
                  maxLength={200}
                />
              </Field>
            </div>
            <Field label={t("fields.address")} htmlFor="school-address">
              <Textarea id="school-address" value={draft.address} onChange={(e) => set("address", e.target.value)} rows={2} maxLength={300} />
            </Field>
          </FormSection>
        </fieldset>

        <div className="flex flex-col-reverse items-stretch gap-3 border-t border-border bg-muted/30 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-5 text-sm" aria-live="polite">
            {error && <span className="font-medium text-destructive">{error}</span>}
            {!error && saved && (
              <span className="inline-flex items-center gap-1.5 font-medium text-success">
                <CheckCircle2 className="size-4" />
                {saved}
              </span>
            )}
            {!error && !saved && !editable && <span className="text-muted-foreground">{t("readOnly")}</span>}
          </div>
          {editable && (
            <div className="flex gap-2">
              {dirty && (
                <Button type="button" variant="outline" onClick={() => setDraft(original)} disabled={saving}>
                  {tc("discard")}
                </Button>
              )}
              <Button type="submit" disabled={saving || (!dirty && !resubmit)}>
                {saving ? tc("saving") : resubmit ? t("saveAndResubmit") : tc("save")}
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}

function FormSection({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-4 p-5 md:grid-cols-[220px_minmax(0,1fr)] md:gap-8">
      <div>
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
