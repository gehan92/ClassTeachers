"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Share2 } from "lucide-react";

/**
 * Reads the current URL client-side (useEffect, not window.location at
 * render time) so server and client render the same markup on first paint —
 * links just stay disabled for the one frame before hydration fills them in.
 */
export function ShareButtons({ title }: { title: string }) {
  const t = useTranslations("adPage.share");
  const [url, setUrl] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing from window.location, not derived render state
    setUrl(window.location.href);
  }, []);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  const channels = [
    { key: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}` },
    { key: "facebook", label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}` },
    { key: "x", label: "X", href: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}` },
    { key: "linkedin", label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}` },
  ];

  return (
    <div className="flex h-fit flex-col gap-3 rounded-lg border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <Share2 className="size-3.5" />
        {t("heading")}
      </h3>
      <div className="flex flex-wrap gap-2">
        {channels.map((channel) => (
          <a
            key={channel.key}
            href={url ? channel.href : undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-disabled={!url}
            className="rounded-full border border-input px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary aria-disabled:pointer-events-none aria-disabled:opacity-50"
          >
            {channel.label}
          </a>
        ))}
      </div>
    </div>
  );
}
