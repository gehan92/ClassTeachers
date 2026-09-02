"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { GradeLadder } from "./grade-ladder";
import { ListingCard } from "./listing-card";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
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
      // gradeBands, not the single gradeBand — an institute typically spans
      // several grade levels across its teachers, so it should match if it
      // covers the selected grade at all, not just its single most-common one.
      const matchesGrade = !grade || listing.gradeBands.includes(grade);
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

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(results.length);
  const pagedResults = results.slice(offset, offset + pageSize);

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
    const resolvedCategory = categoryFromUrl && isCategory(categoryFromUrl) ? categoryFromUrl : "all";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL, not derived render state
    setCategory(resolvedCategory);
    setSubject(subjectFromUrl ?? "");
    setLocation(locationFromUrl ?? "");
    setOnlineOnly(searchParams.get("online") === "true");
    // Campus lecturers are a single grade band by definition — the ladder
    // isn't shown for this category (see render below), so no leftover grade
    // filter from a previous view should silently keep narrowing results here.
    setGrade(resolvedCategory !== "campus" && gradeFromUrl && isGrade(gradeFromUrl) ? gradeFromUrl : undefined);
    setPriceInterval(priceIntervalFromUrl && isPriceInterval(priceIntervalFromUrl) ? priceIntervalFromUrl : "any");
    setPriceMin(searchParams.get("priceMin") ?? "");
    setPriceMax(searchParams.get("priceMax") ?? "");
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- setPage is a stable setState setter from usePagination, intentionally omitted like every other setter above
  }, [searchParams]);

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
    setPage(1);
  }

  return (
    <>
      <div className="mb-7 rounded-2xl border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            value={subject}
            onChange={(e) => {
              setSubject(e.target.value);
              setPage(1);
            }}
            placeholder={category === "campus" ? tSearch("subjectPlaceholderCampus") : tSearch("subjectPlaceholder")}
            className="bg-white"
          />
          <Input
            value={location}
            onChange={(e) => {
              setLocation(e.target.value);
              setPage(1);
            }}
            placeholder={tSearch("locationPlaceholder")}
            className="bg-white"
          />
        </div>
        <div className="mb-3 flex items-center gap-2">
          <Checkbox
            id={onlineOnlyId}
            checked={onlineOnly}
            onCheckedChange={(checked) => {
              setOnlineOnly(checked);
              setPage(1);
            }}
          />
          <Label htmlFor={onlineOnlyId} className="cursor-pointer text-sm font-normal text-foreground/80">
            {tSearch("onlineOnly")}
          </Label>
        </div>
        <div className="mb-3">
          <PriceFilter
            interval={priceInterval}
            onIntervalChange={(interval) => {
              setPriceInterval(interval);
              setPage(1);
            }}
            min={priceMin}
            onMinChange={(value) => {
              setPriceMin(value);
              setPage(1);
            }}
            max={priceMax}
            onMaxChange={(value) => {
              setPriceMax(value);
              setPage(1);
            }}
          />
        </div>
        {category !== "campus" && (
          <GradeLadder
            value={grade}
            onChange={(value) => {
              setGrade(value);
              setPage(1);
            }}
          />
        )}
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
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pagedResults.map((listing, i) => (
              <ListingCard key={listing.id} listing={listing} index={i} />
            ))}
          </div>
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={t("pagination.showingCount", { shown: pagedResults.length, total: results.length })}
            previousLabel={t("pagination.previous")}
            nextLabel={t("pagination.next")}
            pageInfoLabel={t("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-10 text-center text-muted-foreground">
          {t("noResults")}
        </div>
      )}
    </>
  );
}
