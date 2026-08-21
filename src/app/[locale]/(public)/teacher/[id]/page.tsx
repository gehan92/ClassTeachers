import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { FileText, MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { GateNote } from "@/components/features/gate-note";
import { PriceBox } from "@/components/features/price-box";
import { AdSlot } from "@/components/features/ad-slot";
import { LockPill } from "@/components/features/lock-pill";
import { ReviewItem } from "@/components/features/review-item";
import { createClient } from "@/lib/supabase/server";
import { avatarGradientClass } from "@/lib/avatar-color";
import type { TeacherProfileDetail } from "@/types/teacher-profile";

async function loadTeacherProfile(
  id: string,
  locale: string,
): Promise<TeacherProfileDetail | null> {
  const supabase = await createClient();

  const [{ data: rows, error }, { data: reviewRows }, { data: batchRows }, { data: noteRows }, { data: phone }, { data: adRow }] =
    await Promise.all([
      supabase.rpc("get_public_teacher_profile", { p_teacher_id: id }),
      supabase.rpc("list_public_reviews", { p_target_type: "teacher", p_target_id: id }),
      supabase
        .from("batches")
        .select("id, title, mode, location, schedule_note, grade_band")
        .eq("owner_type", "teacher")
        .eq("owner_id", id)
        .eq("status", "active"),
      // RLS-gated (0008): only returns rows when the current viewer is the
      // owner, an enrolled student, or an admin — everyone else gets an
      // empty array here, which is the correct "you can't see these" signal.
      supabase.from("notes").select("id, title, page_count").eq("owner_type", "teacher").eq("owner_id", id),
      supabase.rpc("get_teacher_contact", { p_teacher_id: id }),
      supabase
        .from("advertisements")
        .select("content, title")
        .eq("owner_type", "teacher")
        .eq("owner_id", id)
        .eq("placement", "own_profile")
        .maybeSingle(),
    ]);

  if (error || !rows || rows.length === 0) {
    return null;
  }
  const teacher = rows[0];

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  return {
    id: teacher.id,
    name: teacher.display_name ?? "Teacher",
    headline: teacher.headline,
    bio: teacher.bio,
    location: teacher.location,
    classType: (teacher.class_type as TeacherProfileDetail["classType"]) ?? "physical",
    experienceYears: teacher.experience_years,
    qualifications: teacher.qualifications ?? [],
    photoUrl: teacher.photo_url,
    subjects: teacher.subjects ?? [],
    gradeBand: teacher.grade_band,
    rating: teacher.rating,
    reviewCount: teacher.review_count,
    avatarInitials: (teacher.display_name ?? "T").charAt(0).toUpperCase(),
    hourlyRate: teacher.hourly_rate ?? undefined,
    monthlyRate: teacher.monthly_rate ?? undefined,
    adHeadline: adRow?.title ?? undefined,
    adText: adRow?.content ?? undefined,
    notesCount: teacher.notes_count,
    notes: (noteRows ?? []).map((n) => ({ id: n.id, title: n.title, pageCount: n.page_count })),
    schedule: (batchRows ?? []).map((b) => ({
      id: b.id,
      title: b.title,
      mode: b.mode as "online" | "physical",
      location: b.location,
      scheduleNote: b.schedule_note,
      gradeBand: b.grade_band,
    })),
    reviews: (reviewRows ?? []).map((r) => ({
      id: r.id,
      author: r.author ?? "Anonymous",
      date: dateFormatter.format(new Date(r.created_at)),
      rating: r.rating,
      body: r.body ?? "",
      reply: r.reply ?? undefined,
    })),
    phone,
  } satisfies TeacherProfileDetail;
}

export default async function TeacherProfilePage({
  params,
}: PageProps<"/[locale]/teacher/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const teacher = await loadTeacherProfile(id, locale);
  if (!teacher) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <Hero teacher={teacher} />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-7 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <AboutPanel teacher={teacher} showGate={!user} />
          <QualificationsPanel teacher={teacher} />
          {(teacher.notes.length > 0 || teacher.notesCount > 0) && <NotesPanel teacher={teacher} />}
          {teacher.schedule.length > 0 && <SchedulePanel teacher={teacher} />}
          <QuestionBankPanel />
          <ReviewsPanel teacher={teacher} />
        </div>
        <div className="flex flex-col gap-5">
          <PriceBox hourlyRate={teacher.hourlyRate} monthlyRate={teacher.monthlyRate} joinHref="/signup" />
          {teacher.adText && (
            <AdSlot size="sm" eyebrow={teacher.adHeadline ?? teacher.headline ?? ""} text={teacher.adText} />
          )}
        </div>
      </div>
    </>
  );
}

function Panel({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      {title && <h2 className="mb-4 text-lg">{title}</h2>}
      {children}
    </div>
  );
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5 text-cta">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="size-3.5" fill={i < Math.round(rating) ? "currentColor" : "none"} />
      ))}
    </span>
  );
}

function classTypeLabel(
  t: ReturnType<typeof useTranslations>,
  classType: TeacherProfileDetail["classType"],
) {
  if (classType === "physical") return t("classTypePhysical");
  if (classType === "online") return t("classTypeOnline");
  return t("classTypeBoth");
}

function Hero({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <div className="mx-auto max-w-[1180px] px-7 pt-10">
      <div className="rounded-xl bg-gradient-to-br from-primary to-primary-light p-7 text-white sm:p-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          {teacher.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teacher.photoUrl}
              alt=""
              className="size-20 shrink-0 rounded-full border-4 border-white object-cover shadow-sm"
            />
          ) : (
            <div
              className={`flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-sm ${avatarGradientClass(teacher.id)}`}
            >
              {teacher.avatarInitials}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {teacher.headline && (
              <div className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/70">
                {teacher.headline}
              </div>
            )}
            <h1 className="mb-2 text-[28px] text-white sm:text-[34px]">{teacher.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              {teacher.reviewCount > 0 && (
                <span className="flex items-center gap-1.5">
                  <StarRating rating={teacher.rating} />
                  {teacher.rating.toFixed(1)} ({teacher.reviewCount})
                </span>
              )}
              {teacher.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {teacher.location}
                </span>
              )}
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {classTypeLabel(t, teacher.classType)}
              </span>
              {teacher.experienceYears != null && (
                <span>{t("yearsExperience", { years: teacher.experienceYears })}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 gap-2.5">
            <button
              type="button"
              className="rounded-sm border border-white/40 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
            >
              {t("save")}
            </button>
            <Link
              href="/signup"
              className="inline-flex items-center justify-center rounded-sm bg-cta px-4 py-2 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
            >
              {t("joinTeacher")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AboutPanel({ teacher, showGate }: { teacher: TeacherProfileDetail; showGate: boolean }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("about")}>
      {showGate && <GateNote />}
      <p className="m-0 text-sm text-foreground/85">{teacher.bio || t("noBio")}</p>
    </Panel>
  );
}

function QualificationsPanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("qualifications")}>
      <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3.5 text-sm">
        <div className="text-muted-foreground">{t("degreeLabel")}</div>
        <div className="font-medium text-foreground">
          {teacher.qualifications.length > 0 ? (
            <ul className="m-0 list-disc space-y-1 pl-4">
              {teacher.qualifications.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          ) : (
            "—"
          )}
        </div>

        <div className="text-muted-foreground">{t("experienceLabel")}</div>
        <div className="font-medium text-foreground">
          {teacher.experienceYears != null ? t("yearsExperience", { years: teacher.experienceYears }) : "—"}
        </div>

        <div className="text-muted-foreground">{t("subjectsLabel")}</div>
        <div className="font-medium text-foreground">
          {teacher.subjects.length > 0 ? teacher.subjects.join(", ") : "—"}
        </div>

        <div className="text-muted-foreground">{t("gradeLevelsLabel")}</div>
        <div className="font-medium text-foreground">{teacher.gradeBand ?? "—"}</div>

        <div className="text-muted-foreground">{t("classTypeLabel")}</div>
        <div className="font-medium text-foreground">{classTypeLabel(t, teacher.classType)}</div>

        <div className="text-muted-foreground">{t("phoneLabel")}</div>
        <div>
          {teacher.phone ? (
            <span className="font-medium text-foreground">{teacher.phone}</span>
          ) : (
            <LockPill>{t("phoneLocked")}</LockPill>
          )}
        </div>
      </div>
    </Panel>
  );
}

function NotesPanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("notesTitle")}>
      {teacher.notes.length > 0 ? (
        teacher.notes.map((note) => (
          <div key={note.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
            <FileText className="size-4 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-foreground">{note.title}</div>
              {note.pageCount != null && (
                <div className="text-xs text-muted-foreground">{t("notesSubtitle", { pages: note.pageCount })}</div>
              )}
            </div>
            <Link
              href={`/student/notes/${note.id}/file`}
              className="rounded-sm border border-input px-2.5 py-1 text-xs font-semibold text-primary"
            >
              {t("notesView")}
            </Link>
          </div>
        ))
      ) : (
        <div className="flex items-center justify-between gap-3 py-1">
          <p className="m-0 text-sm text-muted-foreground">
            {t("notesCountTeaser", { count: teacher.notesCount })}
          </p>
          <LockPill>{t("notesLocked")}</LockPill>
        </div>
      )}
    </Panel>
  );
}

function SchedulePanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("scheduleTitle")}>
      {teacher.schedule.map((item) => (
        <div key={item.id} className="flex items-center gap-3 border-b border-border py-3 last:border-b-0">
          <span className="w-16 shrink-0 font-mono text-xs uppercase text-accent-deep">
            {item.mode === "online" ? t("classTypeOnline") : t("classTypePhysical")}
          </span>
          <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
          <span className="text-xs text-muted-foreground">{item.scheduleNote ?? item.location ?? "—"}</span>
        </div>
      ))}
    </Panel>
  );
}

function QuestionBankPanel() {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("questionBankTitle")}>
      <div className="flex flex-wrap items-center gap-2.5">
        <LockPill>{t("questionBankLocked")}</LockPill>
        <p className="m-0 text-sm text-muted-foreground">{t("questionBankText")}</p>
      </div>
    </Panel>
  );
}

function ReviewsPanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("reviewsHeading", { count: teacher.reviewCount, rating: teacher.rating.toFixed(1) })}>
      {teacher.reviews.length > 0 ? (
        teacher.reviews.map((review) => <ReviewItem key={review.id} review={review} />)
      ) : (
        <p className="m-0 py-2 text-sm text-muted-foreground">{t("noReviews")}</p>
      )}
    </Panel>
  );
}
