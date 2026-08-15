export function RoleCard({
  tag,
  title,
  description,
  points,
}: {
  tag: string;
  title: string;
  description: string;
  points: string[];
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
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
  );
}
