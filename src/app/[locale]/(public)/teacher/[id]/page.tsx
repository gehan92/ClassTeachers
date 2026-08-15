import { notFound } from "next/navigation";
import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { CheckCircle2, FileText, MapPin, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { GateNote } from "@/components/features/gate-note";
import { PriceBox } from "@/components/features/price-box";
import { AdSlot } from "@/components/features/ad-slot";
import { LockPill } from "@/components/features/lock-pill";
import { ReviewItem } from "@/components/features/review-item";
import { getTeacherProfile } from "@/lib/mock-data";
import { avatarGradientClass } from "@/lib/avatar-color";
import type { TeacherProfileDetail } from "@/types/teacher-profile";

export default async function TeacherProfilePage({
  params,
}: PageProps<"/[locale]/teacher/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const teacher = getTeacherProfile(id);
  if (!teacher) {
    notFound();
  }

  return (
    <>
      <Hero teacher={teacher} />
      <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-7 py-10 lg:grid-cols-[2fr_1fr]">
        <div className="min-w-0">
          <AboutPanel teacher={teacher} />
          <QualificationsPanel teacher={teacher} />
          <NotesPanel teacher={teacher} />
          <SchedulePanel teacher={teacher} />
          <QuestionBankPanel />
          <ReviewsPanel teacher={teacher} />
        </div>
        <div className="flex flex-col gap-5">
          <PriceBox
            hourlyRate={teacher.hourlyRate}
            monthlyRate={teacher.monthlyRate}
            joinHref="/signup"
          />
          <AdSlot size="sm" eyebrow={teacher.headline} text={teacher.adText} />
          <VerificationPanel />
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
          <div
            className={`flex size-20 shrink-0 items-center justify-center rounded-full border-4 border-white font-display text-2xl font-bold text-white shadow-sm ${avatarGradientClass(teacher.id)}`}
          >
            {teacher.avatarInitials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 font-mono text-xs uppercase tracking-[0.12em] text-white/70">
              {teacher.headline}
            </div>
            <h1 className="mb-2 text-[28px] text-white sm:text-[34px]">{teacher.name}</h1>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/85">
              <span className="flex items-center gap-1.5">
                <StarRating rating={teacher.rating} />
                {teacher.rating.toFixed(1)} ({teacher.reviewCount})
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {teacher.location}
              </span>
              <span className="rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-xs">
                {classTypeLabel(t, teacher.classType)}
              </span>
              <span>{t("yearsExperience", { years: teacher.experienceYears })}</span>
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

function AboutPanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("about")}>
      <GateNote />
      <p className="m-0 text-sm text-foreground/85">{teacher.bio}</p>
    </Panel>
  );
}

function QualificationsPanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("qualifications")}>
      <div className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-3.5 text-sm">
        <div className="text-muted-foreground">{t("degreeLabel")}</div>
        <div className="font-medium text-foreground">{teacher.degree}</div>

        <div className="text-muted-foreground">{t("experienceLabel")}</div>
        <div className="font-medium text-foreground">
          {t("yearsExperience", { years: teacher.experienceYears })}
        </div>

        <div className="text-muted-foreground">{t("subjectsLabel")}</div>
        <div className="font-medium text-foreground">{teacher.subjects.join(", ")}</div>

        <div className="text-muted-foreground">{t("gradeLevelsLabel")}</div>
        <div className="font-medium text-foreground">{teacher.gradeLevels}</div>

        <div className="text-muted-foreground">{t("classTypeLabel")}</div>
        <div className="font-medium text-foreground">{classTypeLabel(t, teacher.classType)}</div>

        <div className="text-muted-foreground">{t("phoneLabel")}</div>
        <div>
          <LockPill>{t("phoneLocked")}</LockPill>
        </div>
      </div>
    </Panel>
  );
}

function NotesPanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("notesTitle")}>
      {teacher.notes.map((note) => (
        <div
          key={note.title}
          className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
        >
          <FileText className="size-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{note.title}</div>
            <div className="text-xs text-muted-foreground">
              {t("notesSubtitle", { pages: note.pages })}
            </div>
          </div>
          <LockPill>{t("notesLocked")}</LockPill>
        </div>
      ))}
    </Panel>
  );
}

function SchedulePanel({ teacher }: { teacher: TeacherProfileDetail }) {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("scheduleTitle")}>
      {teacher.schedule.map((item, i) => (
        <div
          key={`${item.day}-${i}`}
          className="flex items-center gap-3 border-b border-border py-3 last:border-b-0"
        >
          <span className="w-10 shrink-0 font-mono text-xs uppercase text-accent-deep">
            {item.day}
          </span>
          <span className="flex-1 text-sm font-medium text-foreground">{item.title}</span>
          <span className="text-xs text-muted-foreground">{item.time}</span>
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
    <Panel
      title={t("reviewsHeading", { count: teacher.reviewCount, rating: teacher.rating.toFixed(1) })}
    >
      {teacher.reviews.map((review) => (
        <ReviewItem key={review.id} review={review} />
      ))}
    </Panel>
  );
}

function VerificationPanel() {
  const t = useTranslations("profilePage");

  return (
    <Panel title={t("verificationTitle")}>
      <div className="flex flex-col gap-2.5 text-sm">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          <span className="text-foreground">{t("verificationDegree")}</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-4 shrink-0 text-success" />
          <span className="text-foreground">{t("verificationNic")}</span>
        </div>
      </div>
    </Panel>
  );
}
