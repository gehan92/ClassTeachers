import Image from "next/image";
import { ArrowRight, Check } from "lucide-react";
import { Link } from "@/i18n/navigation";

export function RoleCard({
  tag,
  title,
  description,
  points,
  photo,
  action,
}: {
  tag: string;
  title: string;
  description: string;
  points: string[];
  /** Optional — only the /roles page's one-per-row layout uses this. */
  photo?: string;
  /** Optional link under the points, e.g. "Join as a teacher". */
  action?: { href: string; label: string };
}) {
  return (
    <div
      className={
        photo
          ? "grid grid-cols-1 gap-5 rounded-xl border border-border bg-white p-5 shadow-[0_1px_2px_rgba(14,33,29,0.06),0_10px_28px_-16px_rgba(14,33,29,0.2)] sm:grid-cols-[200px_1fr] sm:p-6"
          : "rounded-xl border border-border bg-white p-6 shadow-[0_1px_2px_rgba(14,33,29,0.06),0_10px_28px_-16px_rgba(14,33,29,0.2)]"
      }
    >
      {photo && (
        <div className="relative aspect-4/3 w-full overflow-hidden rounded-lg bg-muted sm:aspect-square">
          <Image src={photo} alt="" fill sizes="(min-width: 640px) 200px, 100vw" quality={70} className="object-cover" />
        </div>
      )}
      <div>
        <span className="mb-3 inline-block rounded-md bg-secondary px-2 py-0.5 font-mono text-[11px] tracking-wide text-secondary-foreground">
          {tag}
        </span>
        <h3 className="mb-2 text-lg">{title}</h3>
        <p className="mb-3.5 text-sm text-muted-foreground">{description}</p>
        <ul className="flex flex-col gap-1.5 text-[13.5px] text-foreground/80">
          {points.map((point) => (
            <li key={point} className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
        {action && (
          <Link
            href={action.href}
            className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-deep hover:text-primary"
          >
            {action.label}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
    </div>
  );
}
