import type { ReactNode } from "react";
import { TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";

/** Dark, monospace "terminal" rendering for a question stem or MCQ option —
 * used for IT/programming questions with code in them. Shared by the
 * teacher's question-bank form/preview and the student's exam view so all
 * three render identically. */
export function TerminalBlock({ children, className, compact }: { children: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md bg-[#0b1120] text-[#d1f7dc] ring-1 ring-white/10",
        compact ? "px-2.5 py-1.5" : "px-3.5 py-3",
        className,
      )}
    >
      <TerminalSquare className={cn("mt-0.5 shrink-0 text-[#5eead4]", compact ? "size-3.5" : "size-4")} />
      <pre className={cn("min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap font-mono", compact ? "text-xs" : "text-sm")}>
        {children}
      </pre>
    </div>
  );
}
