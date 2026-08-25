"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export type ActiveLiveCall = {
  liveClassId: string;
  title: string;
  subtitle?: string;
  roomUrl: string;
  displayName?: string;
  isHost?: boolean;
  minimized: boolean;
};

type StartLiveCallInput = Omit<ActiveLiveCall, "minimized">;

type LiveCallContextValue = {
  activeCall: ActiveLiveCall | null;
  /** No-ops if a DIFFERENT call is already active — only one call runs at a
   * time (see dashboard-shell.tsx for why: the connection now lives above
   * the tab-switching boundary, so silently swapping it out from under the
   * viewer would drop whichever call they were already on). Calling this
   * again for the SAME live class just restores it to the foreground
   * without touching the connection — see VideoCallPanel's own effect deps
   * in inline-file-viewer.tsx, which only reconnect when roomUrl/
   * displayName/isHost actually change. */
  startCall: (call: StartLiveCallInput) => void;
  minimizeCall: () => void;
  restoreCall: () => void;
  /** Actually ends the connection (unmounts VideoCallPanel) — the only
   * action that should ever disconnect from Jitsi. */
  leaveCall: () => void;
};

const LiveCallContext = createContext<LiveCallContextValue | null>(null);

/**
 * Lives above the dashboard's tab-switching boundary (wraps DashboardShell)
 * so a live call's connection lifetime is decoupled from which tab happens
 * to be selected — navigating the dashboard while on a call now minimizes
 * it instead of silently dropping it. See classportals-live-video-calls
 * memory / the "professional fix" discussion this was built from.
 */
export function LiveCallProvider({ children }: { children: ReactNode }) {
  const [activeCall, setActiveCall] = useState<ActiveLiveCall | null>(null);

  const startCall = useCallback((call: StartLiveCallInput) => {
    setActiveCall((current) => {
      if (current && current.liveClassId !== call.liveClassId) return current;
      return { ...call, minimized: false };
    });
  }, []);

  const minimizeCall = useCallback(() => {
    setActiveCall((current) => (current ? { ...current, minimized: true } : current));
  }, []);

  const restoreCall = useCallback(() => {
    setActiveCall((current) => (current ? { ...current, minimized: false } : current));
  }, []);

  const leaveCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const value = useMemo(
    () => ({ activeCall, startCall, minimizeCall, restoreCall, leaveCall }),
    [activeCall, startCall, minimizeCall, restoreCall, leaveCall],
  );

  return <LiveCallContext.Provider value={value}>{children}</LiveCallContext.Provider>;
}

export function useLiveCall(): LiveCallContextValue {
  const ctx = useContext(LiveCallContext);
  if (!ctx) throw new Error("useLiveCall must be used within a LiveCallProvider");
  return ctx;
}
