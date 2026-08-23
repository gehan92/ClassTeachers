"use client";

import { Button } from "@/components/ui/button";

/**
 * Shared "open inside the app" viewer for PDFs and submitted photos —
 * replaces plain `<a target="_blank">` links across Notes, Assignments and
 * Exams so a worksheet, tute, or answer photo opens in-place instead of
 * navigating away to a bare file in a new tab. Swaps in for the surrounding
 * tab content (same pattern as the existing Notes viewer), not a modal.
 */

function ViewerHeader({
  title,
  subtitle,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      <Button size="sm" variant="outline" onClick={onClose}>
        {closeLabel}
      </Button>
    </div>
  );
}

export function PdfViewerPanel({
  title,
  subtitle,
  fileUrl,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  fileUrl: string;
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div>
      <ViewerHeader title={title} subtitle={subtitle} closeLabel={closeLabel} onClose={onClose} />
      <div className="mx-auto h-[85vh] max-w-5xl overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        {/* toolbar=0/navpanes=0 hide the browser's native PDF chrome; view=FitH
            fills the frame's width — same PDF Open Parameters trick as the
            notes viewer. */}
        <iframe src={`${fileUrl}#toolbar=0&navpanes=0&view=FitH`} title={title} className="size-full" />
      </div>
    </div>
  );
}

export function PhotoViewerPanel({
  title,
  subtitle,
  photoUrls,
  closeLabel,
  onClose,
}: {
  title: string;
  subtitle?: string;
  photoUrls: string[];
  closeLabel: string;
  onClose: () => void;
}) {
  return (
    <div>
      <ViewerHeader title={title} subtitle={subtitle} closeLabel={closeLabel} onClose={onClose} />
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        {photoUrls.map((url) => (
          // eslint-disable-next-line @next/next/no-img-element -- signed Supabase Storage URL, not a local/optimizable asset
          <img key={url} src={url} alt="" className="w-full rounded-lg border border-border" />
        ))}
      </div>
    </div>
  );
}
