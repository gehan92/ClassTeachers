"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Menu, LogOut, ChevronDown } from "lucide-react";
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
] as const;

export function SiteHeader({ user }: { user: { name: string; role: UserRole } | null }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isSearchActive = pathname === "/teachers";

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
