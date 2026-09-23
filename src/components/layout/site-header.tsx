"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useLinkStatus } from "next/link";
import { Bell, Menu, LogOut, ChevronDown, Loader2 } from "lucide-react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "./locale-switcher";
import { logOutAction } from "@/lib/auth/actions";
import { roleDashboardPath, type UserRole } from "@/lib/auth/routes";
import { avatarGradientClass } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";
import type { NavAvailability } from "@/lib/nav-availability";

// Home and Advertise open with a full-bleed photo hero — the header sits
// transparent on top of it until the visitor scrolls past it, then becomes
// solid. Solid now matches the dashboard's own header exactly (bg-primary-dark
// + white text, see dashboard-shell.tsx) rather than a plain white bar, so
// the same dark-navy header identity carries across the whole site — and
// since both the transparent and solid states are dark, almost every child
// element below uses the same light-text styling regardless of `transparent`;
// only the header's own background/position differs between the two.
const HERO_PAGES = ["/", "/advertise"];

// Roles/Pricing/Help stay one click away in the footer (see site-footer.tsx)
// rather than crowding the top nav — those are secondary links, not what a
// visitor searching for a teacher or class needs first. Advertise is
// promoted to the top nav as "Post your ad" since it's a primary
// business-facing CTA.
//
// "Institutes / classes", "Campus lecturers" and "Courses" each link to
// their own clean route rather than a /teachers?category= query string —
// /institutes and /lecturers are thin redirects onto the existing
// /teachers?category=class|campus view (same fully-featured search, just a
// friendlier URL), while /courses and its ?audience=adult view are genuinely
// new pages (0143).
const browseItems = [
  { href: { pathname: "/teachers", query: { category: "all" } }, key: "browseAll" },
  { href: { pathname: "/teachers", query: { type: "independent" } }, key: "browseIndependent" },
  { href: "/institutes", key: "browseInstitutes" },
  { href: "/lecturers", key: "browseCampusLecturers" },
  { href: "/courses", key: "browseCourses" },
  { href: { pathname: "/courses", query: { audience: "adult" } }, key: "browseAdultLearning" },
] as const;

// Each direction is a genuinely different ad type (wanted_ads / a
// teacher_seeking_ads / vacancy_ads) that /requests renders based on this
// param — see that page's own `direction` handling (0143).
const requestItems = [
  {
    href: { pathname: "/requests", query: { direction: "student_to_teacher" } },
    key: "requestsStudent",
    tagKey: "requestsStudentTag",
  },
  {
    href: { pathname: "/requests", query: { direction: "teacher_to_institute" } },
    key: "requestsTeacher",
    tagKey: "requestsTeacherTag",
  },
  {
    href: { pathname: "/requests", query: { direction: "institute_to_teacher" } },
    key: "requestsInstitute",
    tagKey: "requestsInstituteTag",
  },
] as const;

type NavHref = string | { pathname: string; query: Record<string, string> };

// Handles both a plain string href (/institutes, /lecturers, /courses) and
// an object href with query params (every /teachers and /requests item) —
// an item is "active" when the pathname matches and, for the object form,
// every one of its own query params matches the current URL too.
function isNavItemActive(href: NavHref, pathname: string, searchParams: URLSearchParams): boolean {
  if (typeof href === "string") return pathname === href;
  if (pathname !== href.pathname) return false;
  return Object.keys(href.query).every((key) => searchParams.get(key) === href.query[key]);
}

const SEARCH_PATHNAMES = ["/teachers", "/requests", "/institutes", "/lecturers", "/courses"];

// Clicking "Dashboard" jumps to a whole different route group ((public) ->
// (dashboard)), so the RSC fetch for the new layout+page can take a visible
// moment with zero feedback otherwise — the button just sits there looking
// clicked-but-frozen until the destination's own loading.tsx skeleton can
// mount. useLinkStatus reports that in-between "pending" state (it reads
// from the nearest ancestor Link, which Button's `render` prop makes this a
// descendant of) so the button can show a spinner immediately on click.
function DashboardButtonLabel({ label }: { label: string }) {
  const { pending } = useLinkStatus();
  if (!pending) return label;
  return (
    <span className="flex items-center gap-1.5">
      <Loader2 className="size-3.5 animate-spin" />
      {label}
    </span>
  );
}

export function SiteHeader({
  user,
  inquiriesCount,
  userPhotoUrl,
  navAvailability,
}: {
  user: { name: string; role: UserRole } | null;
  inquiriesCount?: number;
  userPhotoUrl?: string | null;
  /** A Browse/Requests item is hidden entirely when its destination page
   * would currently show zero results (see lib/nav-availability.ts) —
   * undefined (e.g. a caller that hasn't wired this up) fails open, showing
   * every item, rather than hiding everything on missing data. */
  navAvailability?: NavAvailability;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const visibleBrowseItems = browseItems.filter((item) => navAvailability?.[item.key] !== false);
  const visibleRequestItems = requestItems.filter((item) => navAvailability?.[item.key] !== false);

  const isSearchActive = SEARCH_PATHNAMES.includes(pathname);
  const onlineOnly = searchParams.get("online") === "true";
  // "Online lessons only" (BROWSE group) applies mode=online to whichever
  // page is currently open rather than navigating anywhere — every other
  // query param on the current URL is preserved, only `online` toggles.
  function toggleOnlineOnly(checked: boolean) {
    const query: Record<string, string> = Object.fromEntries(searchParams.entries());
    if (checked) query.online = "true";
    else delete query.online;
    router.push({ pathname, query });
  }
  // Students have no "inquiries" tab (they submit them, don't receive them)
  // — their equivalent inbound-message tab is the one showing responses to
  // their wanted ads, not the ad-management tab itself.
  const bellTab = user?.role === "student" ? "wantedAdResponses" : "inquiries";
  const inquiriesHref = user ? `${roleDashboardPath[user.role]}?tab=${bellTab}` : "/login";
  const userInitial = user ? user.name.charAt(0).toUpperCase() : "";
  const bellLabel = t(bellTab === "wantedAdResponses" ? "myRequests" : "inquiries");

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
      active ? "text-white" : "text-white/70 hover:bg-white/10 hover:text-white",
    );

  return (
    <header
      className={cn(
        "top-0 z-50 w-full border-b text-white transition-[background-color,box-shadow,border-color] duration-200",
        transparent
          ? "fixed border-transparent bg-transparent"
          : "sticky border-primary-dark bg-primary-dark shadow-[0_1px_2px_rgba(0,0,0,0.2)]",
      )}
    >
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-7 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold text-white">
          <span className="flex size-8 items-center justify-center rounded-[7px] bg-secondary font-mono text-[13px] font-bold text-primary-dark">
            CP
          </span>
          ClassPortals
        </Link>

        <span aria-hidden className="hidden h-6 w-px bg-white/20 md:block" />

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<button type="button" aria-current={isSearchActive ? "page" : undefined} className={navLinkClass(isSearchActive)} />}
            >
              {t("search")}
              <ChevronDown className="size-3.5 transition-transform group-aria-expanded:rotate-180" />
              <span
                className={cn(
                  "pointer-events-none absolute inset-x-3.5 -bottom-[1px] h-[2px] rounded-full bg-white transition-opacity",
                  isSearchActive ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-[11px] tracking-wide text-muted-foreground">
                  {t("browseGroupLabel")}
                </DropdownMenuLabel>
                {visibleBrowseItems.map((item) => {
                  const active = isNavItemActive(item.href, pathname, searchParams);
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
                <DropdownMenuCheckboxItem checked={onlineOnly} onCheckedChange={toggleOnlineOnly} className="py-2">
                  {t("browseOnlineOnly")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuLabel className="font-mono text-[11px] tracking-wide text-muted-foreground">
                  {t("requestsGroupLabel")}
                </DropdownMenuLabel>
                {visibleRequestItems.map((item) => {
                  const active = isNavItemActive(item.href, pathname, searchParams);
                  return (
                    <DropdownMenuItem
                      key={item.key}
                      render={<Link href={item.href} />}
                      className={cn("flex flex-col items-start gap-1 py-2", active && "font-semibold text-primary")}
                    >
                      {t(item.key)}
                      <span className="rounded-full bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] font-normal tracking-wide whitespace-nowrap text-primary">
                        {t(item.tagKey)}
                      </span>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuGroup>
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
            className="border-white/40 bg-transparent text-white hover:bg-white/10"
          >
            {t("postYourAd")}
          </Button>
          <LocaleSwitcher className="text-white hover:bg-white/10" />
          {user ? (
            <>
              <Button
                size="sm"
                nativeButton={false}
                render={<Link href={roleDashboardPath[user.role]} />}
                className="bg-cta text-cta-foreground hover:bg-cta-hover"
              >
                <DashboardButtonLabel label={t("dashboard")} />
              </Button>
              {inquiriesCount !== undefined && (
                <Link
                  href={inquiriesHref}
                  aria-label={bellLabel}
                  className="relative flex size-9 items-center justify-center rounded-md text-white/80 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <Bell className="size-4.5" />
                  {inquiriesCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-cta font-mono text-[9px] font-bold text-cta-foreground">
                      {inquiriesCount > 9 ? "9+" : inquiriesCount}
                    </span>
                  )}
                </Link>
              )}
              {userPhotoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, not a local/optimizable asset
                <img src={userPhotoUrl} alt="" title={user.name} className="size-8 shrink-0 rounded-full object-cover" />
              ) : (
                <span
                  title={user.name}
                  aria-label={user.name}
                  className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white ${avatarGradientClass(user.name)}`}
                >
                  {userInitial}
                </span>
              )}
              <form action={logOutAction}>
                <button type="submit" className="flex items-center gap-1.5 px-2 text-sm font-medium text-white/80 transition-colors hover:text-white">
                  <LogOut className="size-4" />
                  {t("logout")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                nativeButton={false}
                render={<Link href="/login" />}
                className="text-white hover:bg-white/10"
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
          <LocaleSwitcher className="text-white hover:bg-white/10" />
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t("menu")} className="hover:bg-white/10" />}>
              <Menu className="size-5 text-white" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
              <nav className="mt-10 flex flex-col gap-1 px-4">
                <div className="px-3 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("browseGroupLabel")}
                </div>
                {visibleBrowseItems.map((item) => {
                  const active = isNavItemActive(item.href, pathname, searchParams);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "rounded-md px-3 py-3 text-sm font-medium transition-colors",
                        active ? "bg-secondary text-primary" : "text-foreground hover:bg-muted",
                      )}
                    >
                      {t(item.key)}
                    </Link>
                  );
                })}
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <Checkbox id="mobile-online-only" checked={onlineOnly} onCheckedChange={toggleOnlineOnly} />
                  <Label htmlFor="mobile-online-only" className="cursor-pointer text-sm font-normal text-foreground/80">
                    {t("browseOnlineOnly")}
                  </Label>
                </div>

                <div className="mt-3 px-3 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("requestsGroupLabel")}
                </div>
                {visibleRequestItems.map((item) => {
                  const active = isNavItemActive(item.href, pathname, searchParams);
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex flex-col items-start gap-1 rounded-md px-3 py-3 text-sm font-medium transition-colors",
                        active ? "bg-secondary text-primary" : "text-foreground hover:bg-muted",
                      )}
                    >
                      {t(item.key)}
                      <span className="rounded-full bg-primary/8 px-1.5 py-0.5 font-mono text-[10px] font-normal tracking-wide whitespace-nowrap text-primary">
                        {t(item.tagKey)}
                      </span>
                    </Link>
                  );
                })}

                <Link
                  href="/advertise"
                  className="mt-3 rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("postYourAd")}
                </Link>
                <Link href="/help" className="rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-muted">
                  {t("help")}
                </Link>
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  {user ? (
                    <>
                      <Button nativeButton={false} render={<Link href={roleDashboardPath[user.role]} />} className="bg-cta text-cta-foreground hover:bg-cta-hover">
                        <DashboardButtonLabel label={t("dashboard")} />
                      </Button>
                      <div className="flex items-center gap-2.5 px-3 py-1.5">
                        {userPhotoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, not a local/optimizable asset
                          <img src={userPhotoUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span
                            className={`flex size-8 shrink-0 items-center justify-center rounded-full font-display text-xs font-bold text-white ${avatarGradientClass(user.name)}`}
                          >
                            {userInitial}
                          </span>
                        )}
                        <span className="truncate text-sm font-medium text-foreground">{user.name}</span>
                      </div>
                      {inquiriesCount !== undefined && (
                        <Link
                          href={inquiriesHref}
                          className="flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium text-foreground hover:bg-muted"
                        >
                          <span className="flex items-center gap-2">
                            <Bell className="size-4" />
                            {bellLabel}
                          </span>
                          {inquiriesCount > 0 && (
                            <span className="flex size-5 items-center justify-center rounded-full bg-cta font-mono text-[10px] font-bold text-cta-foreground">
                              {inquiriesCount > 9 ? "9+" : inquiriesCount}
                            </span>
                          )}
                        </Link>
                      )}
                      <form action={logOutAction}>
                        <button
                          type="submit"
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-input px-3.5 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                        >
                          <LogOut className="size-4" />
                          {t("logout")}
                        </button>
                      </form>
                    </>
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
