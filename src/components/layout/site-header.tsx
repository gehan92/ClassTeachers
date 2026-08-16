"use client";

import { useTranslations } from "next-intl";
import { Menu, LogOut } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { LocaleSwitcher } from "./locale-switcher";
import { logOutAction } from "@/lib/auth/actions";
import { roleDashboardPath, type UserRole } from "@/lib/auth/routes";

// Roles/Advertise/Help stay one click away in the footer (see site-footer.tsx)
// rather than crowding the top nav — those are secondary/business-facing
// links, not what a visitor searching for a teacher or class needs first.
const navItems = [
  { href: { pathname: "/teachers", query: { category: "teacher" } }, key: "findTeachers" },
  { href: { pathname: "/teachers", query: { category: "class" } }, key: "findClasses" },
  { href: "/pricing", key: "pricing" },
] as const;

export function SiteHeader({ user }: { user: { name: string; role: UserRole } | null }) {
  const t = useTranslations("nav");

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1180px] items-center justify-between gap-4 px-7 py-4">
        <Link href="/" className="flex items-center gap-2.5 font-display text-xl font-bold text-primary">
          <span className="flex size-8 items-center justify-center rounded-[7px] bg-primary font-mono text-[13px] font-bold text-secondary">
            CP
          </span>
          ClassPortals
        </Link>

        <nav className="hidden items-center gap-7 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="border-b-2 border-transparent py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:border-ring hover:text-primary"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
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
                {navItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {t(item.key)}
                  </Link>
                ))}
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
