"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { GradeLadder } from "./grade-ladder";
import { ListingCard } from "./listing-card";
import { cn } from "@/lib/utils";
import type { Listing } from "@/types/listing";

type Grade = "1-5" | "6-9" | "10-11" | "12-13" | "campus";
type Category = "all" | "teacher" | "class" | "campus";

const categories: Category[] = ["all", "teacher", "class", "campus"];
const grades: Grade[] = ["1-5", "6-9", "10-11", "12-13", "campus"];

function isCategory(value: string): value is Category {
  return (categories as string[]).includes(value);
}

function isGrade(value: string): value is Grade {
  return (grades as string[]).includes(value);
}

/**
 * "Teacher" is every individual (including campus lecturers) — the
 * homepage's "Find Teachers" link relies on this to show both together.
 * "Campus Lecturer" is the narrower subset, for narrowing further once
 * already browsing teachers. "Class / Institute" stays exact — that's what
 * "Find Classes" links to.
 */
function matchesCategory(listing: Listing, category: Category) {
  switch (category) {
    case "all":
      return true;
    case "teacher":
      return listing.kind === "teacher";
    case "class":
      return listing.kind === "class";
    case "campus":
      return listing.kind === "teacher" && listing.gradeBand === "campus";
  }
}

function CategoryTabs({ value, onChange }: { value: Category; onChange: (category: Category) => void }) {
  const t = useTranslations("teachersPage.categories");

  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className="mb-4 flex flex-wrap gap-1.5"
    >
      {categories.map((category) => (
        <button
          key={category}
          type="button"
          role="radio"
          aria-checked={value === category}
          onClick={() => onChange(category)}
          className={cn(
            "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors",
            value === category
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-white text-foreground/80 hover:bg-secondary",
          )}
        >
          {t(category)}
        </button>
      ))}
    </div>
  );
}

export function TeachersSearch({ listings }: { listings: Listing[] }) {
  const t = useTranslations("teachersPage");
  const tSearch = useTranslations("search");
  const [category, setCategory] = useState<Category>("all");
  const [subject, setSubject] = useState("");
  const [location, setLocation] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [grade, setGrade] = useState<Grade | undefined>(undefined);
  const onlineOnlyId = useId();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Re-sync whenever the URL's search params actually change (not just on
    // mount) — nav links like "Find teachers"/"Find classes" navigate
    // client-side to the same /teachers route with a different ?category=,
    // which reuses this component instance instead of remounting it. A
    // mount-only effect would silently keep the previous filters selected.
    const categoryFromUrl = searchParams.get("category");
    const subjectFromUrl = searchParams.get("subject");
    const locationFromUrl = searchParams.get("location");
    const gradeFromUrl = searchParams.get("grade");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL, not derived render state
    setCategory(categoryFromUrl && isCategory(categoryFromUrl) ? categoryFromUrl : "all");
    setSubject(subjectFromUrl ?? "");
    setLocation(locationFromUrl ?? "");
    setGrade(gradeFromUrl && isGrade(gradeFromUrl) ? gradeFromUrl : undefined);
  }, [searchParams]);

  const results = useMemo(() => {
    const subjectQuery = subject.trim().toLowerCase();
    const locationQuery = location.trim().toLowerCase();

    return listings.filter((listing) => {
      const matchesSubject =
        subjectQuery.length === 0 ||
        listing.subjects.some((s) => s.toLowerCase().includes(subjectQuery)) ||
        listing.name.toLowerCase().includes(subjectQuery);
      const matchesLocation =
        locationQuery.length === 0 ||
        listing.location.toLowerCase().includes(locationQuery) ||
        (locationQuery === "online" && listing.online);
      const matchesOnline = !onlineOnly || listing.online;
      const matchesGrade = !grade || listing.gradeBand === grade;
      return (
        matchesCategory(listing, category) && matchesSubject && matchesLocation && matchesOnline && matchesGrade
      );
    });
  }, [listings, category, subject, location, onlineOnly, grade]);

  const hasFilters =
    category !== "all" || subject.length > 0 || location.length > 0 || onlineOnly || grade !== undefined;

  function clearFilters() {
    setCategory("all");
    setSubject("");
    setLocation("");
    setOnlineOnly(false);
    setGrade(undefined);
  }

  return (
    <>
      <div className="mb-7 rounded-2xl border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <CategoryTabs value={category} onChange={setCategory} />
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={tSearch("subjectPlaceholder")}
            className="bg-white"
          />
          <Input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder={tSearch("locationPlaceholder")}
            className="bg-white"
          />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <Checkbox id={onlineOnlyId} checked={onlineOnly} onCheckedChange={setOnlineOnly} />
          <Label htmlFor={onlineOnlyId} className="cursor-pointer text-sm font-normal text-foreground/80">
            {tSearch("onlineOnly")}
          </Label>
        </div>
        <GradeLadder value={grade} onChange={setGrade} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("resultsCount", { count: results.length })}</p>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="text-sm font-semibold text-primary">
            {t("clearFilters")}
          </button>
        )}
      </div>

      {results.length > 0 ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {results.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-10 text-center text-muted-foreground">
          {t("noResults")}
        </div>
      )}
    </>
  );
}
