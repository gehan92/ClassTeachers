"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { usePagination } from "@/lib/hooks/use-pagination";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { moderateContent } from "@/lib/dashboard/admin-actions";
import { cn } from "@/lib/utils";
import type { ModerationItem } from "@/types/dashboard-admin";

type Kind = ModerationItem["kind"];
type KindFilter = "all" | Kind;
const KINDS: Kind[] = ["note", "exam", "assignment", "ad", "wantedAd"];

/**
 * Admin -> Content: everything teachers and institutes have published, plus
 * student requests, in one searchable list. Removing anything always asks
 * for a reason, which is sent to the owner and kept in the audit log.
 */
export function ModerationTab({ initialItems }: { initialItems: ModerationItem[] }) {
  const t = useTranslations("adminDashboard.moderation");
  const tc = useTranslations("adminDashboard.common");
  const { refresh } = useDashboardRefresh();
  const [items, setItems] = useState(initialItems);
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<ModerationItem | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindLabel: Record<Kind, string> = {
    note: t("kinds.note"),
    exam: t("kinds.exam"),
    assignment: t("kinds.assignment"),
    ad: t("kinds.ad"),
    wantedAd: t("kinds.wantedAd"),
  };
  const consequence: Record<Kind, string> = {
    note: t("consequence.note"),
    exam: t("consequence.exam"),
    assignment: t("consequence.assignment"),
    ad: t("consequence.ad"),
    wantedAd: t("consequence.wantedAd"),
  };

  const counts = useMemo(() => {
    const map: Record<KindFilter, number> = { all: items.length, note: 0, exam: 0, assignment: 0, ad: 0, wantedAd: 0 };
    for (const item of items) map[item.kind] += 1;
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (kind === "all" || item.kind === kind) &&
        (query.length === 0 || item.title.toLowerCase().includes(query) || item.ownerName.toLowerCase().includes(query)),
    );
  }, [items, kind, search]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filtered.length);
  const paged = filtered.slice(offset, offset + pageSize);

  function openRemove(item: ModerationItem) {
    setTarget(item);
    setReason("");
    setError(null);
  }

  async function handleRemove() {
    if (!target) return;
    setSaving(true);
    setError(null);
    const result = await moderateContent({ kind: target.kind, id: target.id, reason });
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const removed = target;
    setTarget(null);
    // A hidden exam stays in the list as a draft; everything else is gone.
    setItems((prev) =>
      removed.kind === "exam"
        ? prev.map((i) => (i.id === removed.id && i.kind === "exam" ? { ...i, detail: t("hiddenDetail") } : i))
        : prev.filter((i) => !(i.id === removed.id && i.kind === removed.kind)),
    );
    refresh();
  }

  const filterKeys: KindFilter[] = ["all", ...KINDS];

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label={t("filterLabel")}>
        {filterKeys.map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={kind === key}
            onClick={() => {
              setKind(key);
              setPage(1);
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              kind === key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-white text-muted-foreground hover:bg-secondary",
            )}
          >
            {key === "all" ? t("kinds.all") : kindLabel[key]}
            <span className={cn("tabular-nums", kind === key ? "opacity-80" : "text-muted-foreground/80")}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      <Input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder={t("searchPlaceholder")}
        className="mb-4 sm:max-w-xs"
      />

      <div className="rounded-lg border border-border bg-white p-5">
        {items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.item")}</TableHead>
                    <TableHead>{t("columns.type")}</TableHead>
                    <TableHead>{t("columns.owner")}</TableHead>
                    <TableHead>{t("columns.date")}</TableHead>
                    <TableHead className="text-right">{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paged.map((item) => (
                    <TableRow key={`${item.kind}:${item.id}`}>
                      <TableCell className="max-w-xs whitespace-normal">
                        <div className="font-medium text-foreground">{item.title}</div>
                        {item.detail && <div className="text-xs text-muted-foreground">{item.detail}</div>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{kindLabel[item.kind]}</TableCell>
                      <TableCell className="text-muted-foreground">{item.ownerName}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{item.createdAt}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {item.viewHref && (
                            <Link
                              href={item.viewHref}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-primary hover:underline"
                            >
                              {t("view")}
                              <ExternalLink className="size-3.5" aria-hidden />
                            </Link>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            disabled={item.kind === "exam" && item.detail === t("hiddenDetail")}
                            onClick={() => openRemove(item)}
                          >
                            {item.kind === "exam" ? t("hide") : t("remove")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                        {t("noMatches")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {filtered.length > 0 && (
              <PaginationFooter
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setPage}
                showingLabel={tc("pagination.showingCount", { shown: paged.length, total: filtered.length })}
                previousLabel={tc("pagination.previous")}
                nextLabel={tc("pagination.next")}
                pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
              />
            )}
          </>
        )}
      </div>

      <Dialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {target ? (target.kind === "exam" ? t("dialog.hideTitle") : t("dialog.removeTitle")) : ""}
            </DialogTitle>
            <DialogDescription>
              {target ? `“${target.title}” · ${target.ownerName}. ${consequence[target.kind]}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="moderation-reason">{t("dialog.reasonLabel")}</Label>
            <Textarea
              id="moderation-reason"
              rows={4}
              maxLength={500}
              value={reason}
              placeholder={t("dialog.reasonPlaceholder")}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t("dialog.reasonHint")}</p>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              {t("dialog.cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRemove}
              disabled={saving || reason.trim().length < 5}
            >
              {target?.kind === "exam" ? t("dialog.confirmHide") : t("dialog.confirmRemove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
