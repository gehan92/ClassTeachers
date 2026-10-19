"use client";

export const SELECT_TAB_EVENT = "dashboard:select-tab";

/** Switches the dashboard to another tab from inside a panel — no page reload, no server round trip. */
export function selectDashboardTab(tab: string) {
  window.dispatchEvent(new CustomEvent(SELECT_TAB_EVENT, { detail: tab }));
}

/**
 * A link to another tab of the same dashboard. Still a real link
 * (?tab=...), so open-in-new-tab and keyboard use work; a normal click is
 * handled in place by DashboardShell.
 */
export function TabLink({
  tab,
  className,
  children,
  ariaLabel,
}: {
  tab: string;
  className?: string;
  children: React.ReactNode;
  ariaLabel?: string;
}) {
  return (
    <a
      href={`?tab=${tab}`}
      aria-label={ariaLabel}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        selectDashboardTab(tab);
      }}
    >
      {children}
    </a>
  );
}
