import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export function AdSlot({
  eyebrow,
  text,
  ctaLabel,
  ctaHref,
  size = "default",
  className,
}: {
  eyebrow: string;
  text: string;
  ctaLabel?: string;
  ctaHref?: string;
  size?: "default" | "sm";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-input bg-[repeating-linear-gradient(135deg,#fff,#fff_10px,#fafbfd_10px,#fafbfd_20px)]",
        size === "sm" ? "p-4" : "p-5.5",
        className,
      )}
    >
      <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.12em] text-accent-deep">{eyebrow}</div>
      <p className={cn("m-0 font-semibold text-foreground", size === "sm" ? "text-sm" : "text-base")}>{text}</p>
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-3 inline-flex items-center rounded-sm border border-input px-3.5 py-1.75 text-[13px] font-semibold text-primary"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
