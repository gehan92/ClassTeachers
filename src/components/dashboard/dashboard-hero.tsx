import type { ComponentProps, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type HeroHref = ComponentProps<typeof Link>["href"];

export type HeroAction = {
  label: string;
  href: HeroHref;
  /** "cta" (gold, filled) for the one primary action, "outline" (default,
   * translucent white) for the rest — mirrors the Institute hero's original
   * "Post ad" vs "Create class"/"Approve teacher" treatment. */
  variant?: "cta" | "outline";
};

export type HeroStat = {
  label: string;
  value: string | number;
  /** Optional — a stat tile links to its own tab when set (e.g. "Students"
   * -> the Students tab), stays plain text otherwise. */
  href?: HeroHref;
};

function HeroStatTile({ label, value, href }: HeroStat) {
  const content = (
    <div className="rounded-lg bg-white/8 px-4 py-3.5 transition-colors hover:bg-white/12">
      <div className="font-mono text-[11px] tracking-wide text-white/55 uppercase">{label}</div>
      <div className="font-display text-2xl text-white">{value}</div>
    </div>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

/**
 * Shared navy hero banner for every dashboard's Home/Overview tab — name +
 * optional badge + subtitle + quick actions, with a row of stat tiles below.
 * Originated on the Institute dashboard (built against Gehan's HTML mockup)
 * and extracted here so Teacher/Student/Admin can use the exact same
 * treatment instead of their old plain-header layout, on request.
 */
export function DashboardHero({
  title,
  badge,
  subtitle,
  actions = [],
  stats,
}: {
  title: ReactNode;
  badge?: string;
  subtitle?: string;
  actions?: HeroAction[];
  stats: HeroStat[];
}) {
  return (
    <div className="rounded-xl bg-primary p-6 sm:p-7">
      <div className="flex flex-wrap items-start justify-between gap-3.5">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 font-display text-2xl text-white">
            {title}
            {badge && (
              <span className="rounded-full bg-cta px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-primary uppercase">
                {badge}
              </span>
            )}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2.5">
            {actions.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className={
                  action.variant === "cta"
                    ? "rounded-sm bg-cta px-3.5 py-2 text-sm font-semibold text-primary hover:bg-cta-hover"
                    : "rounded-sm bg-white/10 px-3.5 py-2 text-sm font-semibold text-white hover:bg-white/15"
                }
              >
                {action.label}
              </Link>
            ))}
          </div>
        )}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((stat) => (
          <HeroStatTile key={stat.label} {...stat} />
        ))}
      </div>
    </div>
  );
}
