import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export function LockPill({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-lock/20 bg-lock/10 px-2 py-0.5 font-mono text-[11px] text-lock",
        className,
      )}
    >
      <Lock className="size-2.5" />
      {children}
    </span>
  );
}
