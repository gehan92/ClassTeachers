"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { GradeLadder } from "./grade-ladder";

type Grade = "1-5" | "6-9" | "10-11" | "12-13" | "campus";

export function SearchCard() {
  const t = useTranslations("search");
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [grade, setGrade] = useState<Grade | undefined>(undefined);

  const query: Record<string, string> = {};
  if (subject.trim()) query.subject = subject.trim();
  if (location.trim()) query.location = location.trim();
  if (grade) query.grade = grade;

  return (
    <div className="rounded-2xl border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      <span className="mb-1.5 block font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("whatLearning")}
      </span>
      <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t("subjectPlaceholder")}
          className="bg-white"
        />
        <Input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder={t("locationPlaceholder")}
          className="bg-white"
        />
      </div>

      <GradeLadder value={grade} onChange={setGrade} />

      <Link
        href={{ pathname: "/teachers", query }}
        className="mt-4 flex w-full items-center justify-center rounded-md bg-cta px-5 py-2.75 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover hover:shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]"
      >
        {t("searchButton")}
      </Link>
    </div>
  );
}
