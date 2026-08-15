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
        className="flex overflow-hidden rounded-md border border-input bg-white"
      >
        {grades.map((grade) => (
          <button
            key={grade}
            type="button"
            role="radio"
            aria-checked={selected === grade}
            onClick={() => select(grade)}
            className={cn(
              "flex-1 border-r border-border px-0.5 py-2.5 text-center font-mono text-xs text-foreground/80 transition-colors last:border-r-0 hover:bg-secondary",
              grade === "campus" && "flex-[1.6] font-sans font-semibold",
              selected === grade
                ? grade === "campus"
                  ? "bg-primary text-white hover:bg-primary-light"
                  : "bg-secondary text-secondary-foreground"
                : grade === "campus" && "bg-primary text-white hover:bg-primary-light",
            )}
          >
            {t(`grades.${grade}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
