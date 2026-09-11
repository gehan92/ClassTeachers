"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Menu, ChevronDown } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "./locale-switcher";
import { roleDashboardPath, type UserRole } from "@/lib/auth/routes";
import { cn } from "@/lib/utils";

// Home and Advertise open with a full-bleed photo hero — the header overlays
// transparently on top of it (matching the classportals-home-v3.html
// reference) until the visitor scrolls past it, then it becomes the normal
// solid nav every other page already uses. Notifications/avatar/logout are
// deliberately not shown here even when signed in (see below) — they still
// live in the dashboard's own header (dashboard-shell.tsx's NotificationBell
// + logout form), so nothing is actually lost, just decluttered off the
// marketing pages.
const HERO_PAGES = ["/", "/advertise"];

// Roles/Pricing/Help stay one click away in the footer (see site-footer.tsx)
// rather than crowding the top nav — those are secondary links, not what a
// visitor searching for a teacher or class needs first. Advertise is
// promoted to the top nav as "Post your ad" since it's a primary
// business-facing CTA.
const searchItems = [
  { href: { pathname: "/teachers", query: { category: "all" } }, key: "searchAll" },
  { href: { pathname: "/teachers", query: { category: "teacher" } }, key: "searchTeachers" },
  { href: { pathname: "/teachers", query: { category: "class" } }, key: "searchInstitutes" },
  { href: { pathname: "/teachers", query: { category: "campus" } }, key: "searchCampusLecturers" },
  {
    href: { pathname: "/teachers", query: { category: "teacher", online: "true" } },
    key: "searchOnlineLessons",
  },
  { href: { pathname: "/requests", query: { lookingFor: "teacher" } }, key: "studentRequestsTeacher" },
  { href: { pathname: "/requests", query: { lookingFor: "institute" } }, key: "studentRequestsInstitute" },
] as const;

// Every item's query keys map to a single string value, and pathname is
// checked first — so an item is "active" exactly when every one of its own
// query params (category, or category+online, or lookingFor) matches the
// current URL. Handles both /teachers and /requests items generically
// instead of hardcoding one pathname/param pair.
function isSearchItemActive(
  item: (typeof searchItems)[number],
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  if (pathname !== item.href.pathname) return false;
  const query: Record<string, string> = item.href.query;
  return Object.keys(query).every((key) => searchParams.get(key) === query[key]);
}

export function SiteHeader({ user }: { user: { name: string; role: UserRole } | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isSearchActive = pathname === "/teachers" || pathname === "/requests";

  const isHeroPage = HERO_PAGES.includes(pathname);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    if (!isHeroPage) return;
    function onScroll() {
      setScrolled(window.scrollY > 80);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isHeroPage]);
  const transparent = isHeroPage && !scrolled;

  const navLinkClass = (active: boolean) =>
    cn(
      "group relative flex items-center gap-1 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
      transparent
        ? "text-white/90 hover:bg-white/10 hover:text-white"
        : active
          ? "text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-primary",
    );

  return (
    <header
      className={cn(
        "top-0 z-50 w-full border-b transition-[background-color,box-shadow,border-color] duration-200",
        transparent
          ? "fixed border-transparent bg-transparent"
          : "sticky border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.06),0_4px_16px_-8px_rgba(14,33,29,0.12)]",
      )}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-7 py-4">
        <Link
          href="/"
          className={cn(
            "flex items-center gap-2.5 font-display text-xl font-bold",
            transparent ? "text-white" : "text-primary",
          )}
        >
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-[7px] font-mono text-[13px] font-bold",
              transparent ? "bg-white text-primary" : "bg-primary text-secondary",
            )}
          >
            CP
          </span>
          ClassPortals
        </Link>

        <span aria-hidden className={cn("hidden h-6 w-px md:block", transparent ? "bg-white/30" : "bg-border")} />

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" aria-current={isSearchActive ? "page" : undefined} className={navLinkClass(isSearchActive)} />}
            >
              {t("search")}
              <ChevronDown className="size-3.5 transition-transform group-aria-expanded:rotate-180" />
              <span
                className={cn(
                  "pointer-events-none absolute inset-x-3.5 -bottom-[1px] h-[2px] rounded-full transition-opacity",
                  transparent ? "bg-white" : "bg-primary",
                  isSearchActive ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {searchItems.map((item) => {
                const active = isSearchItemActive(item, pathname, searchParams);
                return (
                  <DropdownMenuItem
                    key={item.key}
                    render={<Link href={item.href} />}
                    className={cn("py-2", active && "font-semibold text-primary")}
                  >
                    {t(item.key)}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Link href="/help" aria-current={pathname === "/help" ? "page" : undefined} className={navLinkClass(pathname === "/help")}>
            {t("help")}
          </Link>
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/advertise" />}
            className={transparent ? "border-white/40 bg-transparent text-white hover:bg-white/10" : undefined}
          >
            {t("postYourAd")}
          </Button>
          <LocaleSwitcher className={transparent ? "text-white hover:bg-white/10" : undefined} />
          {/* Dashboard is the only signed-in action shown here (matching the
             classportals-home-v3.html reference) — notifications, avatar and
             logout stay inside the dashboard's own header, not duplicated
             on the marketing pages. */}
          {user ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href={roleDashboardPath[user.role]} />}
              className="bg-cta text-cta-foreground hover:bg-cta-hover"
            >
              {t("dashboard")}
            </Button>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/login" />}
                className={transparent ? "text-white hover:bg-white/10" : undefined}
              >
                {t("login")}
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/signup" />} className="bg-cta text-cta-foreground hover:bg-cta-hover">
                {t("joinFree")}
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LocaleSwitcher className={transparent ? "text-white hover:bg-white/10" : undefined} />
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t("menu")} className={transparent ? "hover:bg-white/10" : undefined} />}>
              <Menu className={cn("size-5", transparent ? "text-white" : "text-primary")} />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
              <nav className="mt-10 flex flex-col gap-1 px-4">
                <div className="px-3 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("search")}
                </div>
                {searchItems.map((item) => {
                  const active = isSearchItemActive(item, pathname, searchParams);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active ? "bg-secondary text-primary" : "text-foreground hover:bg-muted",
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  );
                })}
                <Link
                  href="/advertise"
                  className="mt-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("postYourAd")}
                </Link>
                <Link href="/help" className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                  {t("help")}
                </Link>
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  {user ? (
                    <Button nativeButton={false} render={<Link href={roleDashboardPath[user.role]} />} className="bg-cta text-cta-foreground hover:bg-cta-hover">
                      {t("dashboard")}
                    </Button>
                  ) : (
                    <>
                      <Button variant="outline" nativeButton={false} render={<Link href="/login" />}>
                        {t("login")}
                      </Button>
                      <Button nativeButton={false} render={<Link href="/signup" />} className="bg-cta text-cta-foreground hover:bg-cta-hover">
                        {t("joinFree")}
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
