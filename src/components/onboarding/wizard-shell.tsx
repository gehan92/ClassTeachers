"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for every role's onboarding wizard (Student/Teacher/
 * Institute) — deliberately not dismissible (no close button, no
 * click-outside, no Escape handler): the dashboard page that renders this
 * doesn't fetch or render any real dashboard data until onboarding is
 * complete, so there is nothing behind this to reveal even if it could be
 * dismissed. Matches the published Onboarding Wizard Blueprint's "no
 * dismiss, no click-outside-to-close" mechanism section exactly.
 */
export function WizardShell({
  stepIndex,
  stepCount,
  title,
  subtitle,
  children,
  onNext,
  onBack,
  nextDisabled,
  saving,
  error,
  isLastStep,
}: {
  stepIndex: number;
  stepCount: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onNext: () => void;
  onBack?: () => void;
  nextDisabled?: boolean;
  saving?: boolean;
  error?: string | null;
  isLastStep?: boolean;
}) {
  const t = useTranslations("onboarding.common");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-primary to-primary-dark p-5 sm:p-8">
      <div className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-xl animate-in fade-in-0 zoom-in-95 duration-300 sm:p-9">
        <div className="mb-6 flex items-center gap-1.5">
          {Array.from({ length: stepCount }).map((_, i) => (
            <span
              key={i}
              className={cn("h-1.5 flex-1 rounded-full transition-colors", i <= stepIndex ? "bg-primary" : "bg-border")}
            />
          ))}
        </div>
        <p className="mb-1.5 font-mono text-xs uppercase tracking-[0.1em] text-muted-foreground">
          {t("stepOf", { step: stepIndex + 1, total: stepCount })}
        </p>
        <h1 className="mb-1.5 text-xl text-primary">{title}</h1>
        {subtitle && <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>}

        <div className="flex flex-col gap-4">{children}</div>

        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

        <div className="mt-7 flex items-center justify-between gap-3">
          {onBack ? (
            <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
              {t("back")}
            </Button>
          ) : (
            <span />
          )}
          <Button type="button" onClick={onNext} disabled={nextDisabled || saving}>
            {saving ? t("saving") : isLastStep ? t("finish") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}
