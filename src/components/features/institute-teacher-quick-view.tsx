"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { GraduationCap, Star } from "lucide-react";
import { Panel } from "@/components/features/teacher-profile-view";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { InstituteTeacherCard } from "@/types/class-profile";

function TagList({ items }: { items: string[] }) {
  if (items.length === 0) return <>—</>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span key={item} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
          {item}
        </span>
      ))}
    </div>
  );
}

/**
 * The institute page's "Teachers at this institute" panel, plus the
 * credentials-only "quick profile" popup a card opens into — kept as one
 * client component so the open/selected-teacher state can live locally
 * instead of threading through the (server) ClassProfileView.
 *
 * Deliberately does NOT link to /teacher/[id] anymore. That page is a
 * teacher's own independent public listing — personal batches, pricing,
 * the join/contact flow — none of which belongs to "who teaches at this
 * institute." This shows exactly what list_institute_teachers() (0102)
 * now returns: bio, qualifications, experience. Nothing about their
 * private class/business details.
 */
export function InstituteTeachersPanel({ teachers }: { teachers: InstituteTeacherCard[] }) {
  const t = useTranslations("profilePage");
  const [selected, setSelected] = useState<InstituteTeacherCard | null>(null);

  return (
    <>
      <Panel title={t("teachersAtInstitute")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {teachers.map((teacher) => (
            <button
              key={teacher.id}
              type="button"
              onClick={() => setSelected(teacher)}
              className="flex items-start gap-3 rounded-lg border border-border p-3.5 text-left transition-colors hover:border-primary/40 hover:bg-background"
            >
              {teacher.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={teacher.photoUrl} alt="" className="size-11 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <GraduationCap className="size-5 text-secondary-foreground" />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground">{teacher.displayName}</div>
                {teacher.headline && (
                  <div className="mt-0.5 truncate text-[13px] text-muted-foreground">{teacher.headline}</div>
                )}
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                  {teacher.reviewCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-foreground/80">
                      <Star className="size-3 fill-cta text-cta" />
                      {teacher.rating.toFixed(1)} ({teacher.reviewCount})
                    </span>
                  )}
                  {teacher.subjects.slice(0, 2).map((subject) => (
                    <span
                      key={subject}
                      className="rounded-sm border border-border bg-background px-1.5 py-0.5 font-mono text-[10.5px] text-foreground/70"
                    >
                      {subject}
                    </span>
                  ))}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Panel>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>{selected && <TeacherQuickProfile teacher={selected} />}</DialogContent>
      </Dialog>
    </>
  );
}

/** Exported so other "already connected, credentials-only peek" surfaces —
 * e.g. the student dashboard's class workspace — can reuse the exact same
 * rendering instead of duplicating it for a near-identical data shape. */
export function TeacherQuickProfile({ teacher }: { teacher: InstituteTeacherCard }) {
  const t = useTranslations("profilePage");
  const subtitle =
    teacher.isCampusLecturer && (teacher.academicTitle || teacher.institution)
      ? [teacher.academicTitle, teacher.institution].filter(Boolean).join(" · ")
      : teacher.headline;

  const facts: { label: string; value: React.ReactNode }[] = [
    {
      label: t("experienceLabel"),
      value: teacher.experienceYears != null ? t("yearsExperience", { years: teacher.experienceYears }) : "—",
    },
    { label: t("subjectsLabel"), value: <TagList items={teacher.subjects} /> },
    { label: t("languagesLabel"), value: <TagList items={teacher.languages} /> },
  ];

  return (
    <>
      <DialogHeader className="border-b border-border">
        <div className="flex items-start gap-3">
          {teacher.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={teacher.photoUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-secondary">
              <GraduationCap className="size-6 text-secondary-foreground" />
            </div>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <DialogTitle>{teacher.displayName}</DialogTitle>
            {subtitle && <DialogDescription className="truncate">{subtitle}</DialogDescription>}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {teacher.reviewCount > 0 && (
                <span className="flex items-center gap-1 text-xs text-foreground/80">
                  <Star className="size-3 fill-cta text-cta" />
                  {teacher.rating.toFixed(1)} ({teacher.reviewCount})
                </span>
              )}
              {teacher.isCampusLecturer && (
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground/80">
                  {t("campusLecturer")}
                </span>
              )}
            </div>
          </div>
        </div>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        <div className="mb-5">
          <div className="mb-1.5 font-medium text-muted-foreground">{t("about")}</div>
          <p className="m-0 text-sm text-foreground/85">{teacher.bio || t("noBio")}</p>
        </div>

        <div className="flex flex-col gap-5 text-sm">
          <div>
            <div className="mb-1.5 font-medium text-muted-foreground">{t("degreeLabel")}</div>
            {teacher.qualifications.length > 0 ? (
              <ul className="m-0 list-disc space-y-1 pl-4.5 text-foreground">
                {teacher.qualifications.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-foreground">—</p>
            )}
          </div>

          {teacher.workExperience.length > 0 && (
            <div>
              <div className="mb-1.5 font-medium text-muted-foreground">{t("workExperienceLabel")}</div>
              <ul className="m-0 list-disc space-y-1 pl-4.5 text-foreground">
                {teacher.workExperience.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}

          {teacher.isCampusLecturer && teacher.publications.length > 0 && (
            <div>
              <div className="mb-1.5 font-medium text-muted-foreground">{t("publicationsLabel")}</div>
              <ul className="m-0 list-disc space-y-1 pl-4.5 text-foreground">
                {teacher.publications.map((pub, i) => (
                  <li key={i}>{pub}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid grid-cols-1 gap-x-4 gap-y-4 border-t border-border pt-4 sm:grid-cols-2">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <div className="mb-1 text-muted-foreground">{fact.label}</div>
                <div className="font-medium break-words text-foreground">{fact.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
