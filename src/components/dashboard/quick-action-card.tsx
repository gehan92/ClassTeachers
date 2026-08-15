export function QuickActionCard({
  heading,
  body,
  actionLabel,
  onAction,
}: {
  heading: string;
  body: string;
  actionLabel: string;
  onAction?: () => void;
}) {
  return (
    <div className="rounded-lg border border-border bg-white p-4.5">
      <div className="mb-1 font-semibold text-foreground">{heading}</div>
      <p className="mb-3.5 text-sm text-muted-foreground">{body}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-secondary"
      >
        {actionLabel}
      </button>
    </div>
  );
}
