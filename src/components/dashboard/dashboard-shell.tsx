"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  LayoutDashboard,
  UserCircle,
  BookOpen,
  Video,
  VideoOff,
  Mic,
  MicOff,
  FileText,
  ListChecks,
  ClipboardList,
  NotebookPen,
  Users,
  CalendarCheck,
  Star,
  MessageSquare,
  Megaphone,
  Settings as SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { avatarGradientClass } from "@/lib/avatar-color";
import { logOutAction } from "@/lib/auth/actions";
import { RealtimeRefresh, type RealtimeWatch } from "@/components/dashboard/realtime-refresh";
import { LiveCallProvider, useLiveCall } from "@/components/dashboard/live-call-context";
import { VideoCallPanel } from "@/components/dashboard/inline-file-viewer";
import type { DashboardNavGroup, DemoRole } from "@/types/dashboard";

/** Same picker as the public SiteHeader's "Search" dropdown — kept as its own small copy here since the dashboard header's dark theme needs different trigger/item styling, not because the destinations differ. */
const searchItems = [
  { href: { pathname: "/teachers", query: { category: "teacher" } }, key: "searchTeachers" },
  { href: { pathname: "/teachers", query: { category: "class" } }, key: "searchInstitutes" },
  { href: { pathname: "/teachers", query: { category: "campus" } }, key: "searchCampusLecturers" },
  {
    href: { pathname: "/teachers", query: { category: "teacher", online: "true" } },
    key: "searchOnlineLessons",
  },
] as const;

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

/**
 * Icons are looked up by tab key here, in the client component, rather than
 * passed in via `groups` — a server page can't hand a component reference
 * (a function) to a client component as a prop, so this must live wherever
 * `groups` is actually rendered. Only the teacher dashboard's tabs are
 * covered for now; an unmatched key just renders without an icon.
 */
const TAB_ICONS: Partial<Record<string, LucideIcon>> = {
  overview: LayoutDashboard,
  profile: UserCircle,
  classes: BookOpen,
  live: Video,
  notes: FileText,
  questionBank: ListChecks,
  exams: ClipboardList,
  assignments: NotebookPen,
  students: Users,
  attendance: CalendarCheck,
  reviews: Star,
  inquiries: MessageSquare,
  ads: Megaphone,
  settings: SettingsIcon,
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
        {groups.flatMap((g) => g.items).map((item) => {
          const Icon = TAB_ICONS[item.key];
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.75 text-[13px] font-medium whitespace-nowrap transition-colors",
                activeTab === item.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-white text-muted-foreground hover:bg-secondary",
              )}
            >
              {Icon && <Icon className="size-3.5" />}
              {item.label}
              {item.count !== undefined && <span className="ml-1.5 opacity-70">{item.count}</span>}
            </button>
          );
        })}
      </nav>
    );
  }

  return (
    <nav className="flex flex-col gap-5 p-4">
      {groups.map((group, i) => (
        <div key={group.label ?? `group-${i}`}>
          {group.label && (
            <div className="mb-1.5 px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              {group.label}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const Icon = TAB_ICONS[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onSelect(item.key)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                    activeTab === item.key
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground/80 hover:bg-muted",
                  )}
                >
                  {Icon && <Icon className="size-4 shrink-0" />}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.count !== undefined && (
                    <span className="shrink-0 rounded-full bg-background px-1.5 py-0.25 font-mono text-[11px] text-muted-foreground">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function DashboardShell(props: {
  brandBadge?: string;
  userLabel: string;
  userInitial: string;
  userPhotoUrl?: string | null;
  logoutLabel: string;
  demoRole: DemoRole;
  groups: DashboardNavGroup[];
  panels: Record<string, React.ReactNode>;
  defaultTab: string;
  /** Tables to silently live-refresh on — see RealtimeRefresh. Mounted once here, outside panels[activeTab], so it keeps listening no matter which tab is open. */
  realtimeWatch?: RealtimeWatch[];
}) {
  // The call's connection lifetime needs to survive tab switches, so its
  // state has to live above wherever panels[activeTab] gets swapped — see
  // live-call-context.tsx. DashboardShellInner is the one that actually
  // consumes it, since a component can't read a context it provides itself.
  return (
    <LiveCallProvider>
      <DashboardShellInner {...props} />
    </LiveCallProvider>
  );
}

function DashboardShellInner({
  brandBadge,
  userLabel,
  userInitial,
  userPhotoUrl,
  logoutLabel,
  demoRole,
  groups,
  panels,
  defaultTab,
  realtimeWatch,
}: {
  brandBadge?: string;
  userLabel: string;
  userInitial: string;
  userPhotoUrl?: string | null;
  logoutLabel: string;
  demoRole: DemoRole;
  groups: DashboardNavGroup[];
  panels: Record<string, React.ReactNode>;
  defaultTab: string;
  realtimeWatch?: RealtimeWatch[];
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const t = useTranslations("nav");
  const { activeCall, minimizeCall, restoreCall, leaveCall } = useLiveCall();

  // Jitsi defaults to camera+mic on, so a minimized call keeps recording
  // until the viewer explicitly mutes or leaves — easy to forget once it's
  // out of sight. These track live mute state so the minimized bar can warn
  // when something is still capturing, with one-click controls to kill it
  // without restoring the full call view.
  const [micMuted, setMicMuted] = useState(false);
  const [camMuted, setCamMuted] = useState(false);
  const jitsiControlsRef = useRef<{ toggleAudio: () => void; toggleVideo: () => void } | null>(null);

  useEffect(() => {
    if (!activeCall) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting stale state from the call that just ended, not derived render state
      setMicMuted(false);
      setCamMuted(false);
    }
  }, [activeCall]);

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
    // Switching tabs while the call is in the foreground would otherwise
    // hide it with no way back — minimize it instead of losing it.
    if (activeCall && !activeCall.minimized && tab !== activeTab) {
      minimizeCall();
    }
    setActiveTab(tab);
    updateTabParam(tab);
  }

  const navKeys = navKeysByRole[demoRole];
  const siteNavItems = siteNavItemDefs.filter((item) => navKeys.includes(item.key));

  // Reuses the count already passed into groups for the sidebar's own
  // "Inquiries" badge (see teacher/institute page.tsx) — no separate prop
  // needed. Only roles that pass an "inquiries" nav item get the bell.
  const inquiriesItem = groups.flatMap((g) => g.items).find((item) => item.key === "inquiries");

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <RealtimeRefresh watch={realtimeWatch ?? []} />
      <header className="sticky top-0 z-50 flex h-15 shrink-0 items-center justify-between gap-4 border-b border-primary-dark bg-primary-dark px-5 text-white">
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

        <span aria-hidden className="hidden h-6 w-px bg-white/20 lg:block" />

        <nav className="hidden flex-1 items-center gap-1 lg:flex">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="group flex items-center gap-1 rounded-md px-3.5 py-2 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                />
              }
            >
              {t("search")}
              <ChevronDown className="size-3.5 transition-transform group-aria-expanded:rotate-180" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {searchItems.map((item) => (
                <DropdownMenuItem key={item.key} render={<Link href={item.href} />} className="py-2">
                  {t(item.key)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {siteNavItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="px-3.5 py-2 text-sm text-white/70 transition-colors hover:text-white"
            >
              {t(item.key)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            nativeButton={false}
            render={<Link href="/advertise" />}
            className="hidden border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white sm:inline-flex"
          >
            {t("postYourAd")}
          </Button>
          {inquiriesItem && (
            <button
              type="button"
              onClick={() => select("inquiries")}
              aria-label={inquiriesItem.label}
              className="relative flex size-8 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Bell className="size-4.5" />
              {!!inquiriesItem.count && (
                <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-cta font-mono text-[9px] font-bold text-cta-foreground">
                  {inquiriesItem.count > 9 ? "9+" : inquiriesItem.count}
                </span>
              )}
            </button>
          )}
          <LocaleSwitcher className="text-white/70 hover:bg-white/10 hover:text-white" />
          {userPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- public Supabase Storage URL, not a local/optimizable asset
            <img src={userPhotoUrl} alt="" title={userLabel} className="size-7 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              title={userLabel}
              aria-label={userLabel}
              className={`flex size-7 items-center justify-center rounded-full font-display text-xs font-bold text-white ${avatarGradientClass(userLabel)}`}
            >
              {userInitial}
            </span>
          )}
          <form action={logOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">{logoutLabel}</span>
            </button>
          </form>
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
                <div className="px-3 pb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {t("search")}
                </div>
                {searchItems.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    {t(item.key)}
                  </Link>
                ))}
                <Link
                  href="/advertise"
                  className="mt-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                >
                  {t("postYourAd")}
                </Link>
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
        </div>
      </header>

      {activeCall?.minimized &&
        (() => {
          // Jitsi defaults to camera+mic on — anything not explicitly
          // muted is still capturing, minimized or not. Only downgrade to
          // the calmer "in call" styling once both are actually off, so
          // the warning doesn't cry wolf after the viewer's already muted.
          const isExposed = !camMuted || !micMuted;
          return (
            <div
              className={cn(
                "sticky top-15 z-40 flex flex-wrap items-center justify-between gap-2.5 border-b px-5 py-2",
                isExposed ? "border-lock/30 bg-lock/10" : "border-success/30 bg-success/10",
              )}
            >
              <span className={cn("flex items-center gap-2 text-sm font-medium", isExposed ? "text-lock" : "text-foreground")}>
                <Video className={cn("size-4 shrink-0", isExposed ? "text-lock" : "text-success")} />
                {isExposed ? t("stillExposedBanner", { title: activeCall.title }) : t("inCallBanner", { title: activeCall.title })}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => jitsiControlsRef.current?.toggleAudio()}
                  title={micMuted ? t("unmuteMic") : t("muteMic")}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border transition-colors",
                    micMuted ? "border-border bg-white text-muted-foreground" : "border-lock/30 bg-white text-lock hover:bg-lock/10",
                  )}
                >
                  {micMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => jitsiControlsRef.current?.toggleVideo()}
                  title={camMuted ? t("turnOnCamera") : t("turnOffCamera")}
                  className={cn(
                    "flex size-8 items-center justify-center rounded-md border transition-colors",
                    camMuted ? "border-border bg-white text-muted-foreground" : "border-lock/30 bg-white text-lock hover:bg-lock/10",
                  )}
                >
                  {camMuted ? <VideoOff className="size-4" /> : <Video className="size-4" />}
                </button>
                <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={restoreCall}>
                  {t("returnToCall")}
                </Button>
                <Button size="sm" variant="ghost" onClick={leaveCall}>
                  {t("leaveCall")}
                </Button>
              </div>
            </div>
          );
        })()}

      <div className="border-b border-border bg-white md:hidden">
        <NavList groups={groups} activeTab={activeTab} onSelect={select} orientation="horizontal" />
      </div>

      {/* Not max-w/mx-auto'd like the header/footer's inner content — the
         sidebar needs to stay pinned flush against the left edge at every
         viewport width (including past 1400px, whether from a wide monitor
         or the browser zoomed out below 100%). Only the page content inside
         <main> gets capped/centered; the sidebar never should be. */}
      <div className="flex w-full flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-border bg-white md:block">
          <NavList groups={groups} activeTab={activeTab} onSelect={select} orientation="vertical" />
        </aside>
        <main className="min-w-0 flex-1 p-5 sm:p-7">
          <div className="mx-auto max-w-[1400px]">
            {/* The call, once started, stays mounted here regardless of
               which tab is active or whether it's minimized — only
               `leaveCall` (never a tab switch) ever unmounts it, which is
               what actually disconnects from Jitsi. Visibility is a plain
               CSS toggle, not conditional rendering, so minimizing never
               forces a reconnect. */}
            {activeCall && (
              <div style={{ display: activeCall.minimized ? "none" : "block" }}>
                <VideoCallPanel
                  title={activeCall.title}
                  subtitle={activeCall.subtitle}
                  roomUrl={activeCall.roomUrl}
                  displayName={activeCall.displayName}
                  isHost={activeCall.isHost}
                  closeLabel={t("leaveCall")}
                  minimizeLabel={t("minimizeCall")}
                  onClose={leaveCall}
                  onMinimize={minimizeCall}
                  onApiReady={(controls) => {
                    jitsiControlsRef.current = controls;
                  }}
                  onAudioMuteChange={setMicMuted}
                  onVideoMuteChange={setCamMuted}
                />
              </div>
            )}
            <div style={{ display: activeCall && !activeCall.minimized ? "none" : "block" }}>{panels[activeTab]}</div>
          </div>
        </main>
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
