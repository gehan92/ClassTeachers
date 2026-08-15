import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.75 font-mono text-[11px] uppercase tracking-wide before:size-1.5 before:shrink-0 before:rounded-full",
  {
    variants: {
      variant: {
        started: "border-success/25 bg-success/10 text-success before:bg-success",
        active: "border-success/25 bg-success/10 text-success before:bg-success",
        graded: "border-success/25 bg-success/10 text-success before:bg-success",
        upcoming: "border-cta/25 bg-cta/10 text-accent-deep before:bg-cta",
        pending: "border-cta/25 bg-cta/10 text-accent-deep before:bg-cta",
        flagged: "border-lock/25 bg-lock/10 text-lock before:bg-lock",
        suspended: "border-lock/25 bg-lock/10 text-lock before:bg-lock",
        closed: "border-border bg-muted text-muted-foreground before:bg-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "pending",
    },
  },
);

export function StatusBadge({
  variant,
  className,
  children,
}: {
  variant: VariantProps<typeof statusBadgeVariants>["variant"];
  className?: string;
  children: React.ReactNode;
}) {
  return <span className={cn(statusBadgeVariants({ variant }), className)}>{children}</span>;
}
