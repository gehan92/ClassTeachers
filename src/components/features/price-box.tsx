"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function PriceBox({
  hourlyRate,
  monthlyRate,
  joinHref,
  helperText,
}: {
  hourlyRate?: number;
  monthlyRate?: number;
  joinHref: string;
  helperText?: string;
}) {
  const t = useTranslations("priceBox");
  const [interval, setInterval] = useState<"hr" | "mo">(hourlyRate ? "hr" : "mo");
  const amount = interval === "hr" ? hourlyRate : monthlyRate;

  return (
    <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      <div className="mb-3 flex overflow-hidden rounded-md border border-input">
        {hourlyRate !== undefined && (
          <button
            type="button"
            onClick={() => setInterval("hr")}
            className={cn(
              "flex-1 py-2 text-center text-xs font-semibold transition-colors",
              interval === "hr" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary",
            )}
          >
            {t("hourly")}
          </button>
        )}
        {monthlyRate !== undefined && (
          <button
            type="button"
            onClick={() => setInterval("mo")}
            className={cn(
              "flex-1 py-2 text-center text-xs font-semibold transition-colors",
              interval === "mo" ? "bg-primary text-primary-foreground" : "bg-white text-muted-foreground hover:bg-secondary",
            )}
          >
            {t("monthly")}
          </button>
        )}
      </div>

      <div className="mb-1 font-mono text-3xl font-semibold text-primary">
        Rs. {amount?.toLocaleString()}
        <span className="ml-1 text-sm font-normal text-muted-foreground">/{interval}</span>
      </div>
      {helperText && <p className="mb-4 text-xs text-muted-foreground">{helperText}</p>}

      <Link
        href={joinHref}
        className="mt-3 flex w-full items-center justify-center rounded-md bg-cta px-5 py-2.75 text-sm font-semibold text-cta-foreground transition-all hover:-translate-y-px hover:bg-cta-hover"
      >
        {t("join")}
      </Link>
      <button
        type="button"
        className="mt-2 flex w-full items-center justify-center rounded-md border border-input px-5 py-2.75 text-sm font-semibold text-primary transition-all hover:bg-secondary"
      >
        {t("message")}
      </button>
    </div>
  );
}
