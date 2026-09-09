"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
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
  StickyNote,
  FileClock,
  ListChecks,
  ClipboardList,
  NotebookPen,
  BookOpenCheck,
  Users,
  CalendarCheck,
  Star,
  MessageSquare,
  Megaphone,
  BarChart3,
  Settings as SettingsIcon,
  GraduationCap,
  Calendar,
  Inbox,
  Reply,
  BellRing,
  TrendingUp,
  HelpCircle,
  FolderOpen,
  Presentation,
  Building2,
  Layers,
  LayoutGrid,
  Wallet,
  ShieldCheck,
  Maximize2,
  X,
  type LucideIcon,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
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
import { NotificationBell, type NotificationRow } from "@/components/dashboard/notification-bell";
import { LiveCallProvider, useLiveCall } from "@/components/dashboard/live-call-context";
import { VideoCallPanel } from "@/components/dashboard/inline-file-viewer";
import { notifyLiveClassEnded } from "@/lib/dashboard/live-classes-actions";
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
 * `groups` is actually rendered. Covers every role's tabs (teacher +
 * institute share several keys — students/analytics/reviews/inquiries/
 * studentRequests/ads/settings/overview — so one entry serves both); an
 * unmatched key just renders without an icon.
 */
const TAB_ICONS: Partial<Record<string, LucideIcon>> = {
  overview: LayoutDashboard,
  profile: UserCircle,
  classes: BookOpen,
  live: Video,
  notes: FileText,
  shortNotes: StickyNote,
  pastPapers: FileClock,
  questionBank: ListChecks,
  exams: ClipboardList,
  assignments: NotebookPen,
  homework: BookOpenCheck,
  students: Users,
  analytics: BarChart3,
  attendance: CalendarCheck,
  reviews: Star,
  inquiries: MessageSquare,
  ads: Megaphone,
  institute: Building2,
  settings: SettingsIcon,
  progress: TrendingUp,
  requests: Inbox,
  wantedAds: Megaphone,
  wantedAdResponses: Reply,
  // Institute-only tabs (studentRequests is shared with teacher, which had
  // the same gap).
  teachers: GraduationCap,
  batches: BookOpen,
  calendar: Calendar,
  studentRequests: Inbox,
  announcements: BellRing,
};

/**
 * Icons for the group headers themselves (Coursework, Account, ...) — keyed
 * by each group's stable `key` (see types/dashboard.ts), never its translated
 * `label`, for the same reason TAB_ICONS above is keyed by `key` and not by
 * the tab's label. Covers every group key set by every role's page.tsx; an
 * unmatched key just renders without an icon (same fallback as TAB_ICONS).
 */
const GROUP_ICONS: Partial<Record<string, LucideIcon>> = {
  classes: BookOpen,
  content: FolderOpen,
  account: UserCircle,
  teaching: Presentation,
  students: Users,
  institute: Building2,
  manage: Layers,
  platform: LayoutGrid,
  monetization: Wallet,
  trust: ShieldCheck,
  messages: MessageSquare,
  promote: Megaphone,
};

function updateTabParam(tab: string, liveClassId?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("tab", tab);
  if (liveClassId) url.searchParams.set("liveClass", liveClassId);
  else url.searchParams.delete("liveClass");
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
          const isActive = activeTab === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelect(item.key)}
              className={cn(
                "flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.75 text-[13px] font-medium whitespace-nowrap transition-colors",
                isActive
                  ? item.highlight
                    ? "bg-cta text-cta-foreground"
                    : "bg-primary text-primary-foreground"
                  : item.highlight
                    ? "bg-cta/15 text-foreground hover:bg-cta/25"
                    : "bg-white text-muted-foreground hover:bg-secondary",
              )}
            >
              {Icon && <Icon className={cn("size-3.5", item.highlight && !isActive && "text-cta")} />}
              {item.label}
              {item.hasNew && <span className="size-1.5 shrink-0 animate-in zoom-in-50 rounded-full bg-cta duration-300" />}
              {item.count !== undefined && <span className="ml-1.5 opacity-70">{item.count}</span>}
            </button>
          );
        })}
      </nav>
    );
  }

  return <VerticalNavList groups={groups} activeTab={activeTab} onSelect={onSelect} />;
}

function groupKeyFor(group: DashboardNavGroup, index: number) {
  return group.key ?? group.label ?? `group-${index}`;
}

/**
 * Labeled groups (Content, More, ...) are a true accordion — opening one
 * closes whichever other group was open, at most one at a time. Defaults to
 * whichever group holds the active tab; that group also auto-opens (closing
 * any other) if the active tab later moves into it (e.g. a notification-bell
 * jump lands on a tab inside a group the viewer never manually opened), so
 * the highlighted item is never left hidden inside a collapsed section. The
 * one ungrouped row (no `label`, just Home at the top / Messages+Post an Ad
 * at the bottom) always renders with no toggle — unaffected either way.
 */
function VerticalNavList({
  groups,
  activeTab,
  onSelect,
}: {
  groups: DashboardNavGroup[];
  activeTab: string;
  onSelect: (tab: string) => void;
}) {
  function activeGroupKey() {
    const index = groups.findIndex((g) => g.items.some((item) => item.key === activeTab));
    return index === -1 ? null : groupKeyFor(groups[index], index);
  }

  const [expanded, setExpanded] = useState<string | null>(() => activeGroupKey());

  useEffect(() => {
    const key = activeGroupKey();
    if (!key) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing collapse state to an externally-driven activeTab change (URL param, notification jump), not derived render state
    setExpanded(key);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the active tab (or the groups it could belong to) changes, not on every expanded-state update
  }, [activeTab, groups]);

  function toggleGroup(key: string) {
    setExpanded((prev) => (prev === key ? null : key));
  }

  return (
    <nav className="flex flex-col gap-2 p-4">
      {groups.map((group, i) => {
        const key = groupKeyFor(group, i);
        const isOpen = !group.label || expanded === key;
        const groupHasNew = group.items.some((item) => item.hasNew);
        const GroupIcon = group.key ? GROUP_ICONS[group.key] : undefined;
        return (
          <div key={key}>
            {group.label && (
              <button
                type="button"
                onClick={() => toggleGroup(key)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
              >
                {GroupIcon && <GroupIcon className="size-4 shrink-0" />}
                <span className="min-w-0 flex-1 truncate">{group.label}</span>
                {!isOpen && groupHasNew && (
                  <span className="size-1.5 shrink-0 animate-in zoom-in-50 rounded-full bg-cta duration-300" />
                )}
                <ChevronDown className={cn("size-3.5 shrink-0 transition-transform", isOpen && "rotate-180")} />
              </button>
            )}
            {isOpen && (
              <div
                className={cn(
                  "flex flex-col gap-0.5",
                  group.label && "mt-0.5 ml-2.5 border-l border-sidebar-border pl-3",
                )}
              >
                {group.items.map((item) => {
                  const Icon = TAB_ICONS[item.key];
                  const isActive = activeTab === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => onSelect(item.key)}
                      className={cn(
                        "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm font-medium transition-colors",
                        // The connector tick to the group's vertical rail — a
                        // short line from the rail (at -left-3, the container's
                        // border-l) to this row's own left edge, vertically
                        // centered on the row.
                        group.label &&
                          "before:absolute before:-left-3 before:top-1/2 before:h-px before:w-3 before:-translate-y-1/2 before:bg-sidebar-border before:content-['']",
                        isActive
                          ? item.highlight
                            ? "bg-cta text-cta-foreground"
                            : "bg-sidebar-accent text-sidebar-accent-foreground"
                          : item.highlight
                            ? "bg-cta/10 text-sidebar-foreground hover:bg-cta/20"
                            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/40 hover:text-sidebar-foreground",
                      )}
                    >
                      {!group.label && Icon && (
                        <Icon className={cn("size-4 shrink-0", item.highlight && !isActive && "text-cta")} />
                      )}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.hasNew && <span className="size-1.5 shrink-0 animate-in zoom-in-50 rounded-full bg-cta duration-300" />}
                      {item.count !== undefined && (
                        <span className="shrink-0 rounded-full bg-sidebar-border px-1.5 py-0.25 font-mono text-[11px] text-sidebar-foreground/70">
                          {item.count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
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
  /** Recent rows from the notifications table (0105), newest first — the
   * header bell renders these directly rather than jumping to one hardcoded
   * tab's count like it used to. */
  notifications?: NotificationRow[];
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
  notifications = [],
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
  notifications?: NotificationRow[];
}) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  const t = useTranslations("nav");
  const { activeCall, minimizeCall, restoreCall, leaveCall } = useLiveCall();

  // Live mute state, tracked so the floating mini-player's own mic/camera
  // buttons show the right icon and work without restoring the full call.
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

  // Bumped only for a notification's deep link (see select's liveClassId
  // param) so the target panel remounts and re-reads the URL even when the
  // viewer is already sitting on that same tab — an ordinary tab switch
  // already remounts on its own via the `${activeTab}-${navNonce}` key
  // changing, so this only needs to force the issue in that one edge case.
  const [navNonce, setNavNonce] = useState(0);

  function select(tab: string, liveClassId?: string) {
    // Switching tabs while the call is in the foreground would otherwise
    // hide it with no way back — minimize it instead of losing it.
    if (activeCall && !activeCall.minimized && tab !== activeTab) {
      minimizeCall();
    }
    setActiveTab(tab);
    updateTabParam(tab, liveClassId);
    if (liveClassId) setNavNonce((n) => n + 1);
  }

  // Only the host actually ending the call counts as "class ended" — a
  // student leaving their own view of it never fires this. Fire-and-forget,
  // same as the "started" notification in the teacher Live Classes tab.
  function handleLeaveCall() {
    if (activeCall?.isHost) {
      notifyLiveClassEnded(activeCall.liveClassId);
    }
    leaveCall();
  }

  const navKeys = navKeysByRole[demoRole];
  const siteNavItems = siteNavItemDefs.filter((item) => navKeys.includes(item.key));

  // The whole shell is locked to exactly the viewport height (h-dvh, not
  // min-h-screen) with overflow hidden — header, mobile tab strip, and
  // sidebar are fixed in place as ordinary flex children, and only <main>
  // below gets its own scrollbar. dvh (not vh) is what keeps this correct
  // on iOS/Android, where the browser chrome resizing would otherwise clip
  // content under a fixed vh value.
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <RealtimeRefresh watch={realtimeWatch ?? []} />
      <header className="z-50 flex h-15 shrink-0 items-center justify-between gap-4 border-b border-primary-dark bg-primary-dark px-5 text-white">
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
          <Link
            href="/help"
            title={t("help")}
            aria-label={t("help")}
            className="hidden size-8 items-center justify-center rounded-md text-white/70 transition-colors hover:bg-white/10 hover:text-white sm:flex"
          >
            <HelpCircle className="size-4.5" />
          </Link>
          <NotificationBell
            notifications={notifications}
            onNavigate={(tab, data) => select(tab, typeof data.liveClassId === "string" ? data.liveClassId : undefined)}
          />
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
                <div className="mt-3 flex flex-col gap-1">
                  {siteNavItems.map((item) => (
                    <Link
                      key={item.key}
                      href={item.href}
                      className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                    >
                      {t(item.key)}
                    </Link>
                  ))}
                  <Link href="/help" className="rounded-md px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
                    {t("help")}
                  </Link>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <div className="shrink-0 overflow-x-auto border-b border-border bg-white md:hidden">
        <NavList groups={groups} activeTab={activeTab} onSelect={select} orientation="horizontal" />
      </div>

      {/* Not max-w/mx-auto'd like the header's inner content — the sidebar
         needs to stay pinned flush against the left edge at every viewport
         width (including past 1400px, whether from a wide monitor or the
         browser zoomed out below 100%). Only the page content inside <main>
         gets capped/centered; the sidebar never should be.

         min-h-0 on this row (and on <aside>/<main> below) is load-bearing:
         without it, a flex child's default min-height is its content size,
         which would let this row grow past the parent's fixed h-dvh instead
         of stopping at it — the exact bug that would silently undo the
         "only main scrolls" behavior these three overflow-y-auto's exist
         for. */}
      <div className="flex min-h-0 w-full flex-1">
        <aside className="hidden w-60 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar md:block">
          <NavList groups={groups} activeTab={activeTab} onSelect={select} orientation="vertical" />
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:p-7">
          <div className="mx-auto max-w-[1400px]">
            {/* The call, once started, stays mounted here regardless of
               which tab is active or whether it's minimized — only
               `leaveCall` (never a tab switch) ever unmounts it, which is
               what actually disconnects from Jitsi. Minimizing swaps this
               same wrapper into a floating corner mini-player instead of
               hiding it outright, so the class stays visible (and audible)
               while the viewer reads a note or assignment on the tab
               underneath. Both the wrapper and VideoCallPanel's own header
               only ever change className/hidden state, never leave the
               tree, so the video container's DOM node — and the Jitsi
               iframe inside it — is never remounted by any of this. */}
            {activeCall && (
              <div
                className={cn(
                  activeCall.minimized &&
                    "fixed bottom-4 right-4 z-40 w-72 overflow-hidden rounded-lg border border-border bg-white shadow-[0_8px_24px_-8px_rgba(14,33,29,0.35)] animate-in fade-in-0 slide-in-from-bottom-2 duration-200 sm:w-80",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-between gap-2 bg-white px-3 py-2",
                    !activeCall.minimized && "hidden",
                  )}
                >
                  <span className="truncate text-xs font-medium text-foreground">{activeCall.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => jitsiControlsRef.current?.toggleAudio()}
                      title={micMuted ? t("unmuteMic") : t("muteMic")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      {micMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => jitsiControlsRef.current?.toggleVideo()}
                      title={camMuted ? t("turnOnCamera") : t("turnOffCamera")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      {camMuted ? <VideoOff className="size-3.5" /> : <Video className="size-3.5" />}
                    </button>
                    <button
                      type="button"
                      onClick={restoreCall}
                      title={t("returnToCall")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                    >
                      <Maximize2 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleLeaveCall}
                      title={t("leaveCall")}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/10"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                </div>
                <VideoCallPanel
                  title={activeCall.title}
                  subtitle={activeCall.subtitle}
                  roomUrl={activeCall.roomUrl}
                  displayName={activeCall.displayName}
                  isHost={activeCall.isHost}
                  closeLabel={t("leaveCall")}
                  minimizeLabel={t("minimizeCall")}
                  onClose={handleLeaveCall}
                  onMinimize={minimizeCall}
                  onApiReady={(controls) => {
                    jitsiControlsRef.current = controls;
                  }}
                  onAudioMuteChange={setMicMuted}
                  onVideoMuteChange={setCamMuted}
                  compact={activeCall.minimized}
                />
              </div>
            )}
            <div
              key={`${activeTab}-${navNonce}`}
              style={{ display: activeCall && !activeCall.minimized ? "none" : "block" }}
              className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200"
            >
              {panels[activeTab]}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
