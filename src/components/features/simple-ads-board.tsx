"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import { avatarGradientClass } from "@/lib/avatar-color";

/**
 * Generic public board for "Teacher requests" (teacher_seeking_ads) and
 * "Institute vacancies" (vacancy_ads) — 0143. Deliberately not built on top
 * of WantedAdsBoard: that component's shape (lookingFor chips, budget,
 * medium/classType) is specific to student wanted-ads and shouldn't be
 * stretched to fit these two genuinely different ad shapes. Both boards
 * normalize their own row shape down to this one before rendering, same
 * "server maps the RPC row, client just displays" split as everywhere else.
 */
export type SimpleAd = {
  id: string;
  badge: string;
  title: string;
  metaLine: string;
  description: string | null;
  createdLabel: string;
};

function SimpleAdCard({ ad, index }: { ad: SimpleAd; index?: number }) {
  const t = useTranslations("requestsPage");

  return (
    <div
      style={index !== undefined ? { animationDelay: `${Math.min(index, 10) * 45}ms` } : undefined}
      className="flex flex-col overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)] animate-in fade-in-0 slide-in-from-bottom-2 fill-mode-both duration-500"
    >
      <div className="relative flex h-14 items-center bg-gradient-to-br from-primary to-primary-light px-3.5">
        <span className={`rounded-[3px] border border-white/30 bg-white/15 px-2 py-0.5 font-mono text-[11px] tracking-wide text-white`}>
          {ad.badge}
        </span>
        <span className={`ml-auto flex size-8 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarGradientClass(ad.id)}`}>
          {ad.title.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4 pt-3.5">
        <div className="mb-1 line-clamp-2 font-display text-[17px] tracking-wide text-primary">{ad.title}</div>
        <div className="mb-2.5 text-[12.5px] text-muted-foreground">{[ad.metaLine, ad.createdLabel].filter(Boolean).join(" · ")}</div>
        {ad.description && <p className="mb-3.5 line-clamp-3 text-[12.5px] text-muted-foreground">{ad.description}</p>}
        <div className="mt-auto flex items-center border-t border-dashed border-border pt-3.5">
          <span className="rounded-sm border border-input px-3.5 py-1.5 text-[13px] font-semibold text-primary">{t("respondCta")}</span>
        </div>
      </div>
    </div>
  );
}

export function SimpleAdsBoard({ ads, tNamespace }: { ads: SimpleAd[]; tNamespace: string }) {
  const t = useTranslations(tNamespace);
  const [query, setQuery] = useState("");

  const filteredAds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ads;
    return ads.filter(
      (ad) => ad.title.toLowerCase().includes(q) || ad.metaLine.toLowerCase().includes(q) || (ad.description ?? "").toLowerCase().includes(q),
    );
  }, [ads, query]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filteredAds.length);
  const pagedAds = filteredAds.slice(offset, offset + pageSize);

  return (
    <>
      <div className="mb-7 rounded-2xl border border-border bg-white p-5.5 shadow-[0_1px_2px_rgba(14,33,29,0.07),0_8px_24px_-12px_rgba(14,33,29,0.16)]">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(1);
          }}
          placeholder={t("searchPlaceholder")}
          className="bg-white sm:max-w-80"
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t("resultsCount", { count: filteredAds.length })}</p>
        {query.length > 0 && (
          <button type="button" onClick={() => setQuery("")} className="text-sm font-semibold text-primary">
            {t("clearFilters")}
          </button>
        )}
      </div>

      {filteredAds.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pagedAds.map((ad, i) => (
              <SimpleAdCard key={ad.id} ad={ad} index={i} />
            ))}
          </div>
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={t("pagination.showingCount", { shown: pagedAds.length, total: filteredAds.length })}
            previousLabel={t("pagination.previous")}
            nextLabel={t("pagination.next")}
            pageInfoLabel={t("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-input bg-white p-10 text-center text-muted-foreground">{t("empty")}</div>
      )}
    </>
  );
}
