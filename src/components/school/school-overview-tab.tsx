"use client";

import { useTranslations } from "next-intl";
import { Check, ChevronRight, Circle, Clock3, KeyRound, ListChecks, Lock, ShieldCheck, X } from "lucide-react";
import { DashboardHero, type HeroAction, type HeroStat } from "@/components/dashboard/dashboard-hero";
import { TabLink } from "@/components/dashboard/tab-link";
import { SchoolStatusCard } from "@/components/school/school-status-card";
import { useSchoolSummary } from "@/components/school/school-labels";
import { HistoryEventLine } from "@/components/school/school-history-tab";
import { cn } from "@/lib/utils";
import type { SchoolDetails, SchoolHistoryRow } from "@/types/school";

type StepState = "done" | "todo" | "waiting" | "blocked" | "soon";

type Step = { key: string; state: StepState; tab?: string; detail?: string };

export function SchoolOverviewTab({
  school,
  isOwner,
  viewerName,
  rolesCount,
  customRolesCount,
  pendingApprovals,
  changesThisWeek,
  rolesReviewed,
  recentHistory,
  showRoles,
  showApprovals,
  showHistory,
}: {
  school: SchoolDetails;
  isOwner: boolean;
  viewerName: string;
  rolesCount: number;
  customRolesCount: number;
  pendingApprovals: number;
  changesThisWeek: number;
  rolesReviewed: boolean;
  recentHistory: SchoolHistoryRow[];
  showRoles: boolean;
  showApprovals: boolean;
  showHistory: boolean;
}) {
  const t = useTranslations("school.overview");
  const ts = useTranslations("school");
  const summary = useSchoolSummary();

  const approvalState: StepState =
    school.status === "approved" ? "done" : school.status === "pending" ? "waiting" : "blocked";
  const steps: Step[] = [
    { key: "registered", state: "done", detail: t("steps.registered.detail", { date: school.submittedAt }) },
    { key: "approval", state: approvalState, tab: school.status === "rejected" ? "schoolProfile" : undefined },
    { key: "roles", state: rolesReviewed ? "done" : "todo", tab: "roles" },
    { key: "calendar", state: "soon" },
    { key: "structure", state: "soon" },
    { key: "subjects", state: "soon" },
    { key: "staff", state: "soon" },
    { key: "students", state: "soon" },
  ];
  const doneCount = steps.filter((s) => s.state === "done").length;

  const actions: HeroAction[] = isOwner
    ? [
        { label: t("actions.roles"), href: { pathname: "/school", query: { tab: "roles" } }, variant: "cta" },
        { label: t("actions.details"), href: { pathname: "/school", query: { tab: "schoolProfile" } } },
      ]
    : [];
  const stats: HeroStat[] = [
    { label: t("stats.status"), value: ts(`statusShort.${school.status}`) },
    { label: t("stats.roles"), value: rolesCount, href: showRoles ? { pathname: "/school", query: { tab: "roles" } } : undefined },
    {
      label: t("stats.waiting"),
      value: pendingApprovals,
      href: showApprovals ? { pathname: "/school", query: { tab: "approvals" } } : undefined,
    },
    {
      label: t("stats.changes"),
      value: changesThisWeek,
      href: showHistory ? { pathname: "/school", query: { tab: "changeHistory" } } : undefined,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        title={school.name}
        badge={isOwner ? t("principalBadge") : undefined}
        subtitle={summary(school)}
        actions={actions}
        stats={stats}
      />

      <SchoolStatusCard school={school} />

      {isOwner ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl text-primary">{t("setupTitle")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("setupSubtitle")}</p>
              </div>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {t("progress", { done: doneCount, total: steps.length })}
              </span>
            </div>
            <div
              className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={steps.length}
              aria-valuenow={doneCount}
              aria-label={t("progress", { done: doneCount, total: steps.length })}
            >
              <div className="h-full rounded-full bg-success transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
            </div>
            <ol className="mt-5 flex flex-col">
              {steps.map((step, index) => (
                <SetupStep key={step.key} step={step} last={index === steps.length - 1} />
              ))}
            </ol>
          </section>

          <div className="flex flex-col gap-6">
            <section className="rounded-xl border border-border bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg text-primary">{t("recentTitle")}</h2>
                {showHistory && recentHistory.length > 0 && (
                  <TabLink tab="changeHistory" className="inline-flex items-center gap-0.5 text-sm font-semibold text-primary hover:underline">
                    {t("seeAll")}
                    <ChevronRight className="size-4" />
                  </TabLink>
                )}
              </div>
              {recentHistory.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">{t("recentEmpty")}</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {recentHistory.map((row) => (
                    <li key={row.id} className="py-2.5 text-sm">
                      <HistoryEventLine row={row} />
                      <span className="mt-0.5 block text-xs text-muted-foreground">{row.createdAt}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-border bg-secondary/40 p-5">
              <h2 className="flex items-center gap-2 font-display text-lg text-primary">
                <ShieldCheck className="size-5 text-success" />
                {t("safetyTitle")}
              </h2>
              <ul className="mt-3 flex flex-col gap-3 text-sm text-foreground/80">
                <SafetyPoint icon={KeyRound} text={t("safety.roles")} />
                <SafetyPoint icon={ListChecks} text={t("safety.approvals")} />
                <SafetyPoint icon={Lock} text={t("safety.database")} />
              </ul>
              {customRolesCount === 0 && showRoles && (
                <p className="mt-4 text-xs text-muted-foreground">{t("customRolesHint")}</p>
              )}
            </section>
          </div>
        </div>
      ) : (
        <section className="rounded-xl border border-border bg-white p-5 sm:p-6">
          <h2 className="font-display text-xl text-primary">{t("staffWelcome", { name: viewerName })}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("staffWelcomeBody")}</p>
        </section>
      )}
    </div>
  );
}

function SetupStep({ step, last }: { step: Step; last: boolean }) {
  const t = useTranslations("school.overview.steps");
  const ts = useTranslations("school.overview");
  const icon = {
    done: <Check className="size-3.5" strokeWidth={3} />,
    todo: <Circle className="size-2.5 fill-current" />,
    waiting: <Clock3 className="size-3.5" />,
    blocked: <X className="size-3.5" strokeWidth={3} />,
    soon: <Lock className="size-3" />,
  }[step.state];
  const stateLabel = ts(`stepState.${step.state}`);
  const title = t(`${step.key}.title`);
  const detail = step.detail ?? (step.state === "soon" ? ts("comingNext") : t(`${step.key}.detail`));

  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm font-semibold", step.state === "soon" ? "text-muted-foreground" : "text-foreground")}>{title}</span>
        <span className="text-xs leading-snug text-muted-foreground">{detail}</span>
      </span>
      {step.tab && step.state !== "done" && <ChevronRight className="size-4 shrink-0 self-center text-muted-foreground" />}
    </>
  );

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!last && <span aria-hidden className="absolute top-7 bottom-0 left-[13px] w-px bg-border" />}
      <span
        aria-label={stateLabel}
        className={cn(
          "relative z-[1] mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border-2",
          step.state === "done" && "border-success bg-success text-white",
          step.state === "todo" && "border-primary bg-white text-primary",
          step.state === "waiting" && "border-cta bg-cta/15 text-accent-deep",
          step.state === "blocked" && "border-destructive bg-destructive text-white",
          step.state === "soon" && "border-border bg-muted text-muted-foreground",
        )}
      >
        {icon}
      </span>
      {step.tab && step.state !== "done" ? (
        <TabLink tab={step.tab} className="-mx-2 -my-1 flex min-w-0 flex-1 gap-2 rounded-md px-2 py-1 transition-colors hover:bg-muted/60">
          {body}
        </TabLink>
      ) : (
        <div className="flex min-w-0 flex-1 gap-2">{body}</div>
      )}
    </li>
  );
}

function SafetyPoint({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <li className="flex gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
      <span>{text}</span>
    </li>
  );
}
