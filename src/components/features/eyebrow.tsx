import type { ReactNode } from "react";

/** Small uppercase label with a leading tick-mark, used above headings on
 * every redesigned public page (Home, search, detail pages) for a
 * consistent visual rhythm. `dark` swaps to a lighter tint for use over a
 * photo/dark background. */
export function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return (
    <div
      className="mb-2 d-inline-flex align-items-center gap-2 text-uppercase fw-bold"
      style={{ fontSize: 12, letterSpacing: "0.06em", color: dark ? "#f0dfae" : "var(--accent-deep)" }}
    >
      <span style={{ width: 18, height: 1.5, background: dark ? "#f0dfae" : "var(--accent-deep)", display: "inline-block" }} />
      {children}
    </div>
  );
}
