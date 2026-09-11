"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const grades = ["1-5", "6-9", "10-11", "12-13", "campus"] as const;
type Grade = (typeof grades)[number];

export function GradeLadder({
  value,
  onChange,
}: {
  value?: Grade;
  onChange?: (grade: Grade) => void;
}) {
  const t = useTranslations("search");
  const selected = value;

  function select(grade: Grade) {
    onChange?.(grade);
  }

  return (
    <div>
      <div className="mb-2 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
        {t("level")}
      </div>
      <div
        role="radiogroup"
        aria-label={t("level")}
        className="flex overflow-x-auto rounded-md border border-input bg-white sm:overflow-hidden"
      >
        {grades.map((grade) => (
          <button
            key={grade}
            type="button"
            role="radio"
            aria-checked={selected === grade}
            onClick={() => select(grade)}
            className={cn(
              "min-w-[58px] flex-none whitespace-nowrap border-r border-border px-2.5 py-2.5 text-center font-mono text-xs text-foreground/80 transition-colors last:border-r-0 hover:bg-secondary sm:min-w-0 sm:flex-1 sm:px-0.5",
              grade === "campus" && "min-w-[76px] font-sans font-semibold sm:min-w-0 sm:flex-[1.6]",
              selected === grade
                ? grade === "campus"
                  ? "bg-primary text-white hover:bg-primary-light"
                  : "bg-secondary text-secondary-foreground"
                : "bg-white",
            )}
          >
            {t(`grades.${grade}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
