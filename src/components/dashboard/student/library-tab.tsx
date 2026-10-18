"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { incrementLibraryResourceView } from "@/lib/dashboard/library-actions";

export type StudentLibraryRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  instituteName: string;
  fileUrl: string;
  addedLabel: string;
};

/** Read-only view of the PDF resources each of the student's institutes has
 * shared (Institute -> Library). Opening one counts as a view for the
 * institute's own stats. */
export function LibraryTab({ resources }: { resources: StudentLibraryRow[] }) {
  const t = useTranslations("studentDashboard.library");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return resources;
    return resources.filter(
      (r) =>
        r.title.toLowerCase().includes(query) ||
        (r.category ?? "").toLowerCase().includes(query) ||
        r.instituteName.toLowerCase().includes(query),
    );
  }, [resources, search]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="mb-1 text-2xl">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {resources.length > 0 && (
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="mb-4 sm:max-w-xs"
        />
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        {resources.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("noMatches")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {filtered.map((r) => (
              <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3.5 first:pt-0 last:pb-0">
                <div className="flex min-w-0 items-start gap-3">
                  <FileText className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{r.title}</p>
                    {r.description && <p className="text-sm text-muted-foreground">{r.description}</p>}
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[r.instituteName, r.category, t("added", { date: r.addedLabel })].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>
                <a
                  href={r.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary hover:underline"
                  onClick={() => void incrementLibraryResourceView(r.id)}
                >
                  {t("open")}
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
