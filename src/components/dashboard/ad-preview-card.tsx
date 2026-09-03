/**
 * Live "how this will actually look" preview, dropped inline under an ad/
 * promotion composer so the owner can see it before posting instead of only
 * finding out after — mirrors the title/content/meta-chip shape real ad
 * cards render with elsewhere (ListingCard, AdListingRow). Deliberately
 * takes already-translated label strings rather than calling useTranslations
 * itself, same reasoning as PaginationFooter: every dashboard/namespace that
 * uses this knows its own strings, this component shouldn't have to guess.
 */
export function AdPreviewCard({
  badgeLabel,
  emptyLabel,
  title,
  content,
  meta = [],
}: {
  badgeLabel: string;
  emptyLabel: string;
  title?: string;
  content: string;
  meta?: string[];
}) {
  const isEmpty = !content.trim() && !(title ?? "").trim();

  return (
    <div className="rounded-lg border border-dashed border-input bg-background p-4">
      <span className="mb-2 inline-block rounded-full bg-secondary px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-secondary-foreground">
        {badgeLabel}
      </span>
      {isEmpty ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <div className="rounded-md border border-border bg-white p-3.5">
          {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
          {content && <p className="mt-1 text-sm whitespace-pre-line text-muted-foreground">{content}</p>}
          {meta.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {meta.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-border bg-background px-2 py-0.5 text-[11px] text-foreground/80"
                >
                  {item}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
