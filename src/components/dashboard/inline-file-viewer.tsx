"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/**
 * Shared "open inside the app" viewer for PDFs and submitted photos —
 * replaces plain `<a target="_blank">` links across Notes, Assignments and
 * Exams so a worksheet, tute, or answer photo opens in-place instead of
 * navigating away to a bare file in a new tab. Swaps in for the surrounding
 * tab content (same pattern as the existing Notes viewer), not a modal.
 */

function ViewerHeader({
  title,
  subtitle,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <Button size="sm" variant="outline" onClick={onClose}>
        {closeLabel}
      </Button>
    </div>
  );
}

export function PdfViewerPanel({
  title,
  subtitle,
  fileUrl,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  fileUrl: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div>
      <ViewerHeader title={title} subtitle={subtitle} closeLabel={closeLabel} onClose={onClose} />
      <div className="mx-auto h-[85vh] max-w-5xl overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        {/* toolbar=0/navpanes=0 hide the browser's native PDF chrome; view=FitH
            fills the frame's width — same PDF Open Parameters trick as the
            notes viewer. */}
        <iframe src={`${fileUrl}#toolbar=0&navpanes=0&view=FitH`} title={title} className="size-full" />
      </div>
    </div>
  );
}

type JitsiMeetAPI = {
  addEventListener: (event: string, handler: () => void) => void;
  executeCommand: (command: string, ...args: unknown[]) => void;
  dispose: () => void;
};

type JitsiMeetExternalAPIConstructor = new (domain: string, options: Record<string, unknown>) => JitsiMeetAPI;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiMeetExternalAPIConstructor;
  }
}

function loadJitsiScript(domain: string): Promise<JitsiMeetExternalAPIConstructor> {
  if (window.JitsiMeetExternalAPI) {
    return Promise.resolve(window.JitsiMeetExternalAPI);
  }
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-jitsi-domain="${domain}"]`);
    const script = existing ?? document.createElement("script");
    if (!existing) {
      script.src = `https://${domain}/external_api.js`;
      script.async = true;
      script.dataset.jitsiDomain = domain;
      document.head.appendChild(script);
    }
    script.addEventListener("load", () => {
      if (window.JitsiMeetExternalAPI) resolve(window.JitsiMeetExternalAPI);
      else reject(new Error("Jitsi script loaded but JitsiMeetExternalAPI is missing"));
    });
    script.addEventListener("error", () => reject(new Error("Failed to load the Jitsi call script")));
  });
}

/**
 * Uses Jitsi's embedding API rather than a plain `<iframe src={roomUrl}>`
 * so a hangup can be handled in our own UI. The raw-iframe version showed
 * Jitsi's own branded post-call screen (an ad for their paid 8x8 product)
 * the moment anyone left the call — enableClosePage attempts to turn that
 * screen off at the source, and the readyToClose listener is the reliable
 * part: the instant the viewer hangs up, this panel closes itself, so
 * that screen has no chance to appear even if the config flag is ignored.
 *
 * Room access itself is already gated server-side — the join_link only
 * ever reaches the owner, an accepted-enrollment student, or an admin (RLS
 * on live_class_links, see 0012_live_classes.sql). But meet.jit.si is a
 * public server: anyone who gets hold of the raw URL some other way (a
 * student forwards it, a screenshot leaks) can open it directly with no
 * further check. `isHost` turns on Jitsi's own lobby/knock feature the
 * moment the teacher's client joins — on meet.jit.si's anonymous domain,
 * the first participant automatically becomes moderator, which is required
 * to toggle it — so after that, anyone else needs the teacher to admit
 * them by name rather than just having the link.
 */
export function VideoCallPanel({
  title,
  subtitle,
  roomUrl,
  closeLabel,
  onClose,
  minimizeLabel,
  onMinimize,
  displayName,
  isHost = false,
}: {
  title: string;
  subtitle?: string;
  roomUrl: string;
  /** Ends the call for real (disposes the Jitsi connection) — never fired by minimizing. */
  closeLabel: string;
  onClose: () => void;
  /** Hides this panel without disconnecting — the parent is expected to keep it mounted (just visually hidden) so the connection survives. Omit to fall back to a single Close button, e.g. for a context with nowhere to minimize to. */
  minimizeLabel?: string;
  onMinimize?: () => void;
  /** Shown in the participant list and, for a knocking guest, in the moderator's admit/deny prompt. */
  displayName?: string;
  /** Enables the lobby (waiting room) once this client joins, so later joiners need to be admitted by name instead of just having the link. */
  isHost?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    let api: JitsiMeetAPI | null = null;
    let cancelled = false;

    const url = new URL(roomUrl);
    const domain = url.hostname;
    const roomName = url.pathname.slice(1);

    loadJitsiScript(domain)
      .then((JitsiMeetExternalAPI) => {
        if (cancelled || !containerRef.current) return;
        api = new JitsiMeetExternalAPI(domain, {
          roomName,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: displayName ? { displayName } : undefined,
          configOverwrite: { enableClosePage: false, prejoinPageEnabled: false },
        });
        api.addEventListener("readyToClose", () => onCloseRef.current());
        if (isHost) {
          // First joiner is auto-moderator on meet.jit.si's anonymous
          // domain, which is required for this command to take effect —
          // waiting to fire it until this client has actually joined.
          api.addEventListener("videoConferenceJoined", () => {
            api?.executeCommand("toggleLobby", true);
          });
        }
      })
      .catch(() => {
        // Best-effort embed — if the script can't load (offline, ad
        // blocker), the panel just stays empty instead of crashing the
        // dashboard; the Close button above still works.
      });

    return () => {
      cancelled = true;
      api?.dispose();
    };
  }, [roomUrl, displayName, isHost]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-foreground">{title}</div>
          {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {onMinimize && minimizeLabel && (
            <Button size="sm" variant="outline" onClick={onMinimize}>
              {minimizeLabel}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={onClose}>
            {closeLabel}
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className="mx-auto h-[80vh] max-w-5xl overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]"
      />
    </div>
  );
}

export function PhotoViewerPanel({
  title,
  subtitle,
  photoUrls,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  photoUrls: string[];
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div>
      <ViewerHeader title={title} subtitle={subtitle} closeLabel={closeLabel} onClose={onClose} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {photoUrls.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
          <img key={url} src={url} alt="" className="w-full rounded-lg border border-border" />
        ))}
      </div>
    </div>
  );
}
