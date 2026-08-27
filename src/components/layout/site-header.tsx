"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Bell, Menu, LogOut, ChevronDown } from "lucide-react";
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
import { logOutAction } from "@/lib/auth/actions";
import { roleDashboardPath, type UserRole } from "@/lib/auth/routes";
import { avatarGradientClass } from "@/lib/avatar-color";
import { cn } from "@/lib/utils";

// Roles/Pricing/Help stay one click away in the footer (see site-footer.tsx)
// rather than crowding the top nav — those are secondary links, not what a
// visitor searching for a teacher or class needs first. Advertise is
// promoted to the top nav as "Post your ad" since it's a primary
// business-facing CTA.
const searchItems = [
  { href: { pathname: "/teachers", query: { category: "teacher" } }, key: "searchTeachers" },
  { href: { pathname: "/teachers", query: { category: "class" } }, key: "searchInstitutes" },
  { href: { pathname: "/teachers", query: { category: "campus" } }, key: "searchCampusLecturers" },
  {
    href: { pathname: "/teachers", query: { category: "teacher", online: "true" } },
    key: "searchOnlineLessons",
  },
  { href: { pathname: "/requests", query: { category: undefined } }, key: "studentRequests" },
] as const;

export function SiteHeader({
  user,
  inquiriesCount,
  userPhotoUrl,
}: {
  user: { name: string; role: UserRole } | null;
  inquiriesCount?: number;
  userPhotoUrl?: string | null;
}) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isSearchActive = pathname === "/teachers";
  // Students have no "inquiries" tab (they submit them, don't receive them)
  // — their equivalent inbound-message tab is Post an Ad's wanted-ad
  // responses, same as the dashboard header's bellKey (dashboard-shell.tsx).
  const bellTab = user?.role === "student" ? "wantedAds" : "inquiries";
  const inquiriesHref = user ? `${roleDashboardPath[user.role]}?tab=${bellTab}` : "/login";
  const userInitial = user ? user.name.charAt(0).toUpperCase() : "";
  const bellLabel = t(bellTab === "wantedAds" ? "myRequests" : "inquiries");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-7 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold text-primary">
          <span className="flex size-8 items-center justify-center rounded-[7px] bg-primary font-mono text-[13px] font-bold text-secondary">
            CP
          </span>
          ClassPortals
        </Link>

        <span aria-hidden className="hidden h-6 w-px bg-border md:block" />

        <nav className="hidden flex-1 items-center gap-1 md:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-current={isSearchActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-1 rounded-md px-3.5 py-2 text-sm font-medium transition-colors",
                    isSearchActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-primary",
                  )}
                />
              }
            >
              {t("search")}
              <ChevronDown className="size-3.5 transition-transform group-aria-expanded:rotate-180" />
              <span
                className={cn(
                  "pointer-events-none absolute inset-x-3.5 -bottom-[1px] h-[2px] rounded-full bg-primary transition-opacity",
                  isSearchActive ? "opacity-100" : "opacity-0",
                )}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {searchItems.map((item) => {
                const active =
                  pathname === "/teachers" && searchParams.get("category") === item.href.query.category;
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
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/advertise" />}>
            {t("postYourAd")}
          </Button>
          <LocaleSwitcher />
          {user ? (
            <>
              <Button size="sm" nativeButton={false} render={<Link href={roleDashboardPath[user.role]} />}>
                {t("dashboard")}
              </Button>
              {inquiriesCount !== undefined && (
                <Link
                  href={inquiriesHref}
                  aria-label={bellLabel}
                  className="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-primary"
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
                <button
                  type="submit"
                  className="flex items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
                >
                  <LogOut className="size-4" />
                  {t("logout")}
                </button>
              </form>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/login" />}>
                {t("login")}
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/signup" />}>
                {t("joinFree")}
              </Button>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LocaleSwitcher />
          <Sheet>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label={t("menu")} />}>
              <Menu className="size-5 text-primary" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
              <nav className="mt-10 flex flex-col gap-1 px-4">
                <div className="px-3 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("search")}
                </div>
                {searchItems.map((item) => {
                  const active = pathname === "/teachers" && searchParams.get("category") === item.href.query.category;
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
                <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
                  {user ? (
                    <>
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
                          className="flex items-center justify-between rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
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
                      <Button nativeButton={false} render={<Link href={roleDashboardPath[user.role]} />}>
                        {t("dashboard")}
                      </Button>
                      <form action={logOutAction}>
                        <button
                          type="submit"
                          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-input px-3.5 py-2 text-sm font-semibold text-foreground hover:bg-muted"
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
                      <Button nativeButton={false} render={<Link href="/signup" />}>
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
