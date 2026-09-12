export function RoleCard({
  tag,
  title,
  description,
  points,
  photo,
}: {
  tag: string;
  title: string;
  description: string;
  points: string[];
  /** Optional — only the /roles page's one-per-row layout uses this; the
   * Home page's 4-up grid stays photo-less since a thumbnail has no room
   * to read at that width. */
  photo?: string;
}) {
  return (
    <div
      className={
        photo
          ? "grid grid-cols-1 gap-4.5 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] sm:grid-cols-[220px_1fr]"
          : "rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]"
      }
    >
      {photo && (
        // eslint-disable-next-line @next/next/no-img-element -- external Pexels stock photo, not a local/optimizable asset
        <img src={photo} alt="" className="aspect-4/3 w-full rounded-md object-cover sm:aspect-square" />
      )}
      <div>
        <span className="mb-3 inline-block rounded-[3px] bg-secondary px-2 py-0.75 font-mono text-[11px] tracking-wide text-secondary-foreground">
          {tag}
        </span>
        <h3 className="mb-2 text-lg">{title}</h3>
        <p className="mb-3.5 text-sm text-muted-foreground">{description}</p>
        <ul className="list-disc space-y-1.25 pl-4.5 text-[13.5px] text-muted-foreground">
          {points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
