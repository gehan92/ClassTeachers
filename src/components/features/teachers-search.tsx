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
type PriceInterval = "any" | "hr" | "mo";

const categories: Category[] = ["all", "teacher", "class", "campus"];
const grades: Grade[] = ["1-5", "6-9", "10-11", "12-13", "campus"];
const priceIntervals: PriceInterval[] = ["any", "hr", "mo"];

function isCategory(value: string): value is Category {
  return (categories as string[]).includes(value);
}

function isGrade(value: string): value is Grade {
  return (grades as string[]).includes(value);
}

function isPriceInterval(value: string): value is PriceInterval {
  return (priceIntervals as string[]).includes(value);
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

function PriceFilter({
  interval,
  onIntervalChange,
  min,
  onMinChange,
  max,
  onMaxChange,
}: {
  interval: PriceInterval;
  onIntervalChange: (interval: PriceInterval) => void;
  min: string;
  onMinChange: (value: string) => void;
  max: string;
  onMaxChange: (value: string) => void;
}) {
  const t = useTranslations("search");

  return (
    <div>
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{t("price")}</div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div
          role="radiogroup"
          aria-label={t("price")}
          className="flex overflow-hidden rounded-md border border-input bg-white"
        >
          {priceIntervals.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={interval === value}
              onClick={() => onIntervalChange(value)}
              className={cn(
                "flex-1 border-r border-border px-3 py-2.5 text-center font-mono text-xs text-foreground/80 transition-colors last:border-r-0 hover:bg-secondary",
                interval === value && "bg-secondary text-secondary-foreground",
              )}
            >
              {t(`priceIntervals.${value}`)}
            </button>
          ))}
        </div>
        <div className="flex flex-1 items-center gap-2">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={min}
            onChange={(e) => onMinChange(e.target.value)}
            placeholder={t("priceMinPlaceholder")}
            className="bg-white"
          />
          <span className="text-muted-foreground">–</span>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={max}
            onChange={(e) => onMaxChange(e.target.value)}
            placeholder={t("priceMaxPlaceholder")}
            className="bg-white"
          />
        </div>
      </div>
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
  const [priceInterval, setPriceInterval] = useState<PriceInterval>("any");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
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
    const priceIntervalFromUrl = searchParams.get("priceInterval");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL, not derived render state
    setCategory(categoryFromUrl && isCategory(categoryFromUrl) ? categoryFromUrl : "all");
    setSubject(subjectFromUrl ?? "");
    setLocation(locationFromUrl ?? "");
    setGrade(gradeFromUrl && isGrade(gradeFromUrl) ? gradeFromUrl : undefined);
    setPriceInterval(priceIntervalFromUrl && isPriceInterval(priceIntervalFromUrl) ? priceIntervalFromUrl : "any");
    setPriceMin(searchParams.get("priceMin") ?? "");
    setPriceMax(searchParams.get("priceMax") ?? "");
  }, [searchParams]);

  const results = useMemo(() => {
    const subjectQuery = subject.trim().toLowerCase();
    const locationQuery = location.trim().toLowerCase();
    const minPrice = priceMin.trim() === "" ? undefined : Number(priceMin);
    const maxPrice = priceMax.trim() === "" ? undefined : Number(priceMax);

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
      const matchesPriceInterval = priceInterval === "any" || listing.price.interval === priceInterval;
      const matchesPriceMin = minPrice === undefined || Number.isNaN(minPrice) || listing.price.amount >= minPrice;
      const matchesPriceMax = maxPrice === undefined || Number.isNaN(maxPrice) || listing.price.amount <= maxPrice;
      return (
        matchesCategory(listing, category) &&
        matchesSubject &&
        matchesLocation &&
        matchesOnline &&
        matchesGrade &&
        matchesPriceInterval &&
        matchesPriceMin &&
        matchesPriceMax
      );
    });
  }, [listings, category, subject, location, onlineOnly, grade, priceInterval, priceMin, priceMax]);

  const hasFilters =
    category !== "all" ||
    subject.length > 0 ||
    location.length > 0 ||
    onlineOnly ||
    grade !== undefined ||
    priceInterval !== "any" ||
    priceMin.length > 0 ||
    priceMax.length > 0;

  function clearFilters() {
    setCategory("all");
    setSubject("");
    setLocation("");
    setOnlineOnly(false);
    setGrade(undefined);
    setPriceInterval("any");
    setPriceMin("");
    setPriceMax("");
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
        <div className="mb-3">
          <PriceFilter
            interval={priceInterval}
            onIntervalChange={setPriceInterval}
            min={priceMin}
            onMinChange={setPriceMin}
            max={priceMax}
            onMaxChange={setPriceMax}
          />
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
