"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, MapPin, Search } from "lucide-react";
import { useRouter } from "@/i18n/navigation";

type Grade = "1-5" | "6-9" | "10-11" | "12-13" | "campus" | "adult";
const ANY_GRADE = "all";
const GRADES: Grade[] = ["1-5", "6-9", "10-11", "12-13", "campus", "adult"];

const fieldClass =
  "h-12 w-full min-w-0 rounded-lg border border-input bg-white text-[15px] text-foreground placeholder:text-muted-foreground/80 focus:border-ring focus:ring-3 focus:ring-ring/25 focus:outline-none";

/**
 * The homepage search. A real form, so Enter searches from any field. On a
 * phone it shows the two fields people actually use (subject, town) and
 * leaves the level for the results page's own filters.
 */
export function SearchCard() {
  const t = useTranslations("search");
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [grade, setGrade] = useState<Grade | typeof ANY_GRADE>(ANY_GRADE);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const query: Record<string, string> = {};
    if (subject.trim()) query.subject = subject.trim();
    if (location.trim()) query.location = location.trim();
    if (grade !== ANY_GRADE) query.grade = grade;
    router.push({ pathname: "/teachers", query });
  }

  return (
    <form
      role="search"
      onSubmit={submit}
      className="grid grid-cols-1 gap-2 rounded-xl bg-white p-2.5 shadow-[0_24px_60px_-20px_rgba(13,20,18,0.55)] sm:grid-cols-[1.4fr_1fr_auto] lg:grid-cols-[1.4fr_1fr_0.9fr_auto]"
    >
      <label className="relative block">
        <span className="sr-only">{t("whatLearning")}</span>
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("subjectPlaceholder")}
          enterKeyHint="search"
          className={`${fieldClass} pr-3 pl-10`}
        />
      </label>
      <label className="relative block">
        <span className="sr-only">{t("locationLabel")}</span>
        <MapPin className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t("locationPlaceholder")}
          enterKeyHint="search"
          className={`${fieldClass} pr-3 pl-10`}
        />
      </label>
      <label className="relative hidden lg:block">
        <span className="sr-only">{t("level")}</span>
        <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <select
          value={grade}
          onChange={(e) => setGrade(e.target.value as Grade | typeof ANY_GRADE)}
          className={`${fieldClass} appearance-none pr-9 pl-3.5`}
        >
          <option value={ANY_GRADE}>{t("anyLevel")}</option>
          {GRADES.map((g) => (
            <option key={g} value={g}>
              {t(`grades.${g}`)}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cta px-7 text-[15px] font-semibold text-cta-foreground transition-colors hover:bg-cta-hover focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      >
        <Search className="size-4.5" aria-hidden />
        {t("searchButton")}
      </button>
    </form>
  );
}
