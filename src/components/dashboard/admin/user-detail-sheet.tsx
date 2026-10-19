"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BadgeCheck, Ban, CalendarClock, Loader2, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/features/status-badge";
import { getAdminUserDetail } from "@/lib/dashboard/admin-insights-actions";
import { avatarGradientClass } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { AdminUserDetail, PlatformUser } from "@/types/dashboard-admin";

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * Admin -> Users -> click a person: everything about that account on one
 * panel — contact, sign-in activity, listing state, their classes or
 * enrolments, payments, and every admin action ever taken on them.
 */
export function UserDetailSheet({ user, onClose }: { user: PlatformUser | null; onClose: () => void }) {
  const t = useTranslations("adminDashboard.userDetail");
  const tr = useTranslations("adminDashboard.reports");
  const tu = useTranslations("adminDashboard.users");
  const tc = useTranslations("adminDashboard.connections");
  const locale = useLocale();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- starting a fetch for the newly opened user
    setLoadingId(user.id);
    setDetail(null);
    setError(null);
    getAdminUserDetail(user.id, locale).then((result) => {
      if (cancelled) return;
      setLoadingId(null);
      if (result.error || !result.detail) setError(result.error ?? t("loadError"));
      else setDetail(result.detail);
    });
    return () => {
      cancelled = true;
    };
  }, [user, locale, t]);

  const roleLabel = (role: string) =>
    role === "admin" ? t("admin") : tu(`roles.${role === "campus_lecturer" ? "campusLecturer" : role}`);

  return (
    <Sheet open={user !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {user && (
          <>
            <SheetHeader className="border-b border-border p-5">
              <div className="flex items-center gap-3 pr-8">
                <Avatar className="size-12">
                  <AvatarFallback className={cn("text-base", avatarGradientClass(user.name))}>{initialsFor(user.name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <SheetTitle className="flex items-center gap-1.5 truncate font-display text-lg text-primary">
                    {user.name}
                    {user.institutionVerified && <BadgeCheck className="size-4 shrink-0 text-primary" aria-label={t("verified")} />}
                  </SheetTitle>
                  <SheetDescription className="flex flex-wrap items-center gap-2">
                    {roleLabel(user.role)}
                    <StatusBadge variant={user.status === "active" ? "active" : "suspended"}>
                      {user.status === "active" ? t("active") : t("suspended")}
                    </StatusBadge>
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            <div className="flex flex-col gap-6 p-5">
              {loadingId === user.id && (
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
                  <Loader2 className="size-4 animate-spin" />
                  {t("loading")}
                </p>
              )}
              {error && <p className="text-sm font-medium text-destructive">{error}</p>}

              {detail && (
                <>
                  <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <InfoRow icon={Mail} label={t("email")} value={detail.email ?? "—"} />
                    <InfoRow icon={Phone} label={t("phone")} value={detail.phone ?? "—"} />
                    <InfoRow icon={MapPin} label={t("location")} value={detail.location ?? "—"} />
                    <InfoRow icon={CalendarClock} label={t("joined")} value={detail.joinedAt} />
                    <InfoRow icon={CalendarClock} label={t("lastSignIn")} value={detail.lastSignInAt ?? t("never")} />
                    <InfoRow icon={BadgeCheck} label={t("onboarding")} value={detail.onboarded ? t("onboardingDone") : t("onboardingPending")} />
                    {detail.listingStatus && (
                      <InfoRow
                        icon={ShieldAlert}
                        label={t("listing")}
                        value={`${t(`listingStatus.${detail.listingStatus}`)}${detail.published === false ? ` · ${t("hidden")}` : ""}`}
                      />
                    )}
                    {detail.suspended && <InfoRow icon={Ban} label={t("account")} value={t("suspendedLong")} tone="destructive" />}
                  </dl>

                  {detail.stats.length > 0 && (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {detail.stats.map((s) => (
                        <div key={s.label} className={cn("rounded-lg border border-border p-3", s.label === "reports" && "border-destructive/30 bg-destructive/5")}>
                          <span className="block text-[11px] text-muted-foreground">{t(`stats.${s.label}`)}</span>
                          <span className="font-display text-lg text-primary tabular-nums">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Section title={user.role === "student" ? t("enrolments") : t("classes")} empty={t("none")} count={detail.classes.length}>
                    {detail.classes.map((c, i) => (
                      <li key={`${c.title}-${i}`} className="flex flex-col py-2">
                        <span className="text-sm font-medium text-foreground">{c.title}</span>
                        <span className="text-xs text-muted-foreground">
                          {c.status && tc.has(`requestStatus.${c.status}`) ? `${tc(`requestStatus.${c.status}`)} · ` : ""}
                          {c.detail}
                        </span>
                      </li>
                    ))}
                  </Section>

                  {user.role === "student" && (
                    <Section title={t("payments")} empty={t("none")} count={detail.payments.length}>
                      {detail.payments.map((p, i) => (
                        <li key={i} className="flex items-center justify-between gap-3 py-2">
                          <span className="min-w-0">
                            <span className="block text-sm text-foreground">{tr(`purposes.${p.purpose}`)}</span>
                            <span className="block text-xs text-muted-foreground">{p.date}</span>
                          </span>
                          <span className="text-right">
                            <span className="block text-sm font-semibold tabular-nums">Rs. {p.amount.toLocaleString(locale)}</span>
                            <span className="block text-xs text-muted-foreground">{tr(`paymentStatus.${p.status}`)}</span>
                          </span>
                        </li>
                      ))}
                    </Section>
                  )}

                  <Section title={t("adminActions")} empty={t("noAdminActions")} count={detail.adminActions.length}>
                    {detail.adminActions.map((a, i) => (
                      <li key={i} className="flex flex-col py-2">
                        <span className="text-sm font-medium text-foreground">{t.has(`actions.${a.action}`) ? t(`actions.${a.action}`) : a.action}</span>
                        {a.details && <span className="text-xs break-words text-muted-foreground">{a.details}</span>}
                        <span className="text-[11px] text-muted-foreground">{t("byAdmin", { name: a.adminName, date: a.date })}</span>
                      </li>
                    ))}
                  </Section>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Mail;
  label: string;
  value: string;
  tone?: "destructive";
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      <Icon className={cn("mt-0.5 size-4 shrink-0 text-muted-foreground", tone === "destructive" && "text-destructive")} />
      <div className="min-w-0">
        <dt className="text-[11px] text-muted-foreground">{label}</dt>
        <dd className={cn("m-0 break-words text-foreground", tone === "destructive" && "font-medium text-destructive")}>{value}</dd>
      </div>
    </div>
  );
}

function Section({ title, empty, count, children }: { title: string; empty: string; count: number; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-foreground">
        {title}
        <span className="rounded-full bg-muted px-1.5 text-[11px] font-medium text-muted-foreground tabular-nums">{count}</span>
      </h3>
      {count === 0 ? <p className="py-2 text-sm text-muted-foreground">{empty}</p> : <ul className="divide-y divide-border">{children}</ul>}
    </section>
  );
}
