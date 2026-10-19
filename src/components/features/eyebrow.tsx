import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Small uppercase label with a leading tick-mark, used above headings on
 * every public page for a consistent visual rhythm. `dark` swaps to a
 * lighter tint for use over a photo/dark background. */
export function Eyebrow({ children, dark, className }: { children: ReactNode; dark?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "mb-2 inline-flex items-center gap-2 text-xs font-bold tracking-[0.08em] uppercase",
        dark ? "text-[#f0dfae]" : "text-accent-deep",
        className,
      )}
    >
      <span aria-hidden className={cn("inline-block h-[1.5px] w-[18px]", dark ? "bg-[#f0dfae]" : "bg-accent-deep")} />
      {children}
    </div>
  );
}
