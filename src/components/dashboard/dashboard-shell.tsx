"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut, Menu } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { avatarGradientClass } from "@/lib/avatar-color";
import { logOutAction } from "@/lib/auth/actions";
import type { DashboardNavGroup, DemoRole } from "@/types/dashboard";

/** Master list of destinations, shared with the public SiteHeader's hrefs — which subset shows depends on role, see navKeysByRole below. */
const siteNavItemDefs = [
  { href: { pathname: "/teachers", query: { category: "teacher" } }, key: "findTeachers" },
  { href: { pathname: "/teachers", query: { category: "class" } }, key: "findClasses" },
  { href: "/roles", key: "roles" },
  { href: "/advertise", key: "advertise" },
  { href: "/pricing", key: "pricing" },
  { href: "/help", key: "help" },
] as const;

type SiteNavKey = (typeof siteNavItemDefs)[number]["key"];

/**
 * Every role's dashboard header stays browse-link-free — Roles/Pricing/Help
 * live in the dashboard footer instead (see the <footer> below), and
 * browsing teachers/classes is one click away via the "ClassPortals" logo
 * back to the homepage's own Search dropdown. Kept as a per-role map (rather
 * than deleting the mechanism) so a role can pick up nav items later without
 * a structural change — see the siteNavItems.length checks below, which
 * hide the nav/menu entirely while every role's list is empty.
 */
const navKeysByRole: Record<DemoRole, SiteNavKey[]> = {
  student: [],
  teacher: [],
  class: [],
  lecturer: [],
  admin: [],
};

function updateTabParam(tab: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  window.history.replaceState(null, "", url);
}

function NavList({
  groups,
  activeTab,
  onSelect,
  orientation,
}: {
  groups: DashboardNavGroup[];
  activeTab: string;
  onSelect: (tab: string) => void;
  orientation: "vertical" | "horizontal";
}) {
  if (orientation === "horizontal") {
    return (
      <nav className="flex gap-1.5 overflow-x-auto px-4 py-2.5">
        {groups.flatMap((g) => g.items).map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            className={cn(
              "shrink-0 rounded-full px-3.5 py-1.75 text-[13px] font-medium whitespace-nowrap transition-colors",
              activeTab === item.key
                ? "bg-primary text-primary-foreground"
                : "bg-white text-muted-foreground hover:bg-secondary",
            )}
          >
            {item.label}
            {item.count !== undefined && <span className="ml-1.5 opacity-70">{item.count}</span>}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-5 p-4">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="mb-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            {group.label}
          </div>
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                className={cn(
                  "flex items-center justify-between rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                  activeTab === item.key
                    ? "bg-secondary text-secondary-foreground"
                    : "text-foreground/80 hover:bg-muted",
                )}
              >
                {item.label}
                {item.count !== undefined && (
                  <span className="rounded-full bg-background px-1.5 py-0.25 font-mono text-[11px] text-muted-foreground">
                    {item.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DashboardShell({
  brandBadge,
  publicProfileHref,
  publicProfileLabel,
  userLabel,
  userInitial,
  logoutLabel,
  demoRole,
  groups,
  panels,
  defaultTab,
}: {
  brandBadge?: string;
  publicProfileHref?: string;
  publicProfileLabel?: string;
  userLabel: string;
  userInitial: string;
  logoutLabel: string;
  demoRole: DemoRole;
  groups: DashboardNavGroup[];
  panels: Record<string, React.ReactNode>;
  defaultTab: string;
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const t = useTranslations("nav");

  useEffect(() => {
    // Only read the URL once, on mount — after that, tab state is owned
    // locally. Deliberately not a lazy useState initializer: that would
    // read window.location during the first client render and mismatch
    // the server-rendered defaultTab, breaking hydration.
    const fromUrl = new URLSearchParams(window.location.search).get("tab");
    if (fromUrl && panels[fromUrl] && fromUrl !== defaultTab) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from the URL, not derived render state
      setActiveTab(fromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function select(tab: string) {
    setActiveTab(tab);
    updateTabParam(tab);
  }

  const navKeys = navKeysByRole[demoRole];
  const siteNavItems = siteNavItemDefs.filter((item) => navKeys.includes(item.key));

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 flex h-15 shrink-0 items-center justify-between border-b border-primary-dark bg-primary-dark px-5 text-white">
        <Link href="/" className="flex items-center gap-2.5 font-display text-lg font-bold text-white">
          <span className="flex size-7 items-center justify-center rounded-[6px] bg-secondary font-mono text-xs font-bold text-primary-dark">
            CP
          </span>
          ClassPortals
          {brandBadge && (
            <span className="rounded-sm bg-white/10 px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-white/70">
              {brandBadge}
            </span>
          )}
        </Link>

        {siteNavItems.length > 0 && (
          <nav className="hidden items-center gap-5 lg:flex">
            {siteNavItems.map((item) => (
              <Link
                key={item.key}
                href={item.href}
                className="text-sm text-white/70 transition-colors hover:text-white"
              >
                {t(item.key)}
              </Link>
            ))}
          </nav>
        )}

        <div className="flex items-center gap-3">
          <LocaleSwitcher className="text-white/70 hover:bg-white/10 hover:text-white" />
          {publicProfileHref && (
            <Link href={publicProfileHref} className="hidden text-sm text-white/70 hover:text-white sm:inline">
              {publicProfileLabel} ↗
            </Link>
          )}
          <div className="flex items-center gap-2 text-sm">
            <span
              className={`flex size-7 items-center justify-center rounded-full font-display text-xs font-bold text-white ${avatarGradientClass(userLabel)}`}
            >
              {userInitial}
            </span>
            <span className="hidden sm:inline">{userLabel}</span>
          </div>
          <form action={logOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{logoutLabel}</span>
            </button>
          </form>
          {siteNavItems.length > 0 && (
            <Sheet>
              <SheetTrigger
                aria-label={t("menu")}
                className="flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white lg:hidden"
              >
                <Menu className="size-4.5" />
              </SheetTrigger>
              <SheetContent side="right" className="w-72">
                <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
                <nav className="mt-10 flex flex-col gap-1 px-4">
                  {siteNavItems.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {t(item.key)}
                    </Link>
                  ))}
                </nav>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </header>

      <div className="border-b border-border bg-white md:hidden">
        <NavList groups={groups} activeTab={activeTab} onSelect={select} orientation="horizontal" />
      </div>

      <div className="mx-auto flex w-full max-w-[1400px] flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-white md:block">
          <NavList groups={groups} activeTab={activeTab} onSelect={select} orientation="vertical" />
        </aside>
        <main className="min-w-0 flex-1 p-5 sm:p-7">{panels[activeTab]}</main>
      </div>

      <footer className="border-t border-border bg-white px-5 py-4">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
          <Link href="/roles" className="hover:text-primary">{t("roles")}</Link>
          <Link href="/pricing" className="hover:text-primary">{t("pricing")}</Link>
          <Link href="/help" className="hover:text-primary">{t("help")}</Link>
        </div>
      </footer>
    </div>
  );
}
