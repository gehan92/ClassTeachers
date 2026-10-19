import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** The plain <select> styling the sign-up forms already use (see lecturer-fields.tsx), so it posts with FormData and works on every phone. */
export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
