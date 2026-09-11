"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

type Grade = "1-5" | "6-9" | "10-11" | "12-13" | "campus";
const ANY_GRADE = "all";
const GRADES: Grade[] = ["1-5", "6-9", "10-11", "12-13", "campus"];

export function SearchCard() {
  const t = useTranslations("search");
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [grade, setGrade] = useState<Grade | typeof ANY_GRADE>(ANY_GRADE);

  const query: Record<string, string> = {};
  if (subject.trim()) query.subject = subject.trim();
  if (location.trim()) query.location = location.trim();
  if (grade !== ANY_GRADE) query.grade = grade;

  return (
    <div
      className="d-flex flex-column flex-sm-row flex-wrap bg-white position-relative"
      style={{ boxShadow: "0 20px 50px rgba(13,20,18,0.28)", borderRadius: 10, padding: 16, gap: 10 }}
    >
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder={t("subjectPlaceholder")}
        className="form-control"
        style={{ flex: "1 1 200px", padding: "11px 13px" }}
      />
      <input
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder={t("locationPlaceholder")}
        className="form-control"
        style={{ flex: "1 1 200px", padding: "11px 13px" }}
      />
      <select
        value={grade}
        onChange={(e) => setGrade(e.target.value as Grade | typeof ANY_GRADE)}
        className="form-select"
        style={{ flex: "1 1 160px", padding: "11px 13px" }}
      >
        <option value={ANY_GRADE}>{t("anyLevel")}</option>
        {GRADES.map((g) => (
          <option key={g} value={g}>
            {t(`grades.${g}`)}
          </option>
        ))}
      </select>
      <Link
        href={{ pathname: "/teachers", query }}
        className="btn d-flex align-items-center justify-content-center fw-semibold flex-shrink-0"
        style={{ background: "var(--cta)", color: "var(--cta-foreground)", padding: "12px 26px" }}
      >
        {t("searchButton")}
      </Link>
    </div>
  );
}
