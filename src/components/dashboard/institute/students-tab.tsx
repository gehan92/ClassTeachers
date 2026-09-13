"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { PaginationFooter } from "@/components/dashboard/pagination-footer";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { usePagination } from "@/lib/hooks/use-pagination";
import { respondToJoinRequest, bulkEnrollStudentsByPhone, type BulkEnrollResult } from "@/lib/dashboard/batches-actions";

export type InstituteStudentRow = {
  id: string;
  name: string;
  batch: string;
  joinedAt: string;
  phone: string | null;
};

export type InstituteJoinRequestRow = {
  id: string;
  studentName: string;
  batch: string;
  /** Null for a general "Join this institute" request (requestToJoinClass,
   * 0103) — the request came in with no class picked yet, so the institute
   * can optionally choose one below before accepting. Already-set for a
   * batch-scoped request (requestToJoin), which picked its class at apply
   * time — no picker needed there. */
  batchId: string | null;
  requestedAt: string;
};

function initialsFor(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function StudentsTab({
  students,
  requests: initialRequests,
  batchOptions = [],
}: {
  students: InstituteStudentRow[];
  requests: InstituteJoinRequestRow[];
  /** For the batch picker on a general (batchId === null) request. */
  batchOptions?: { id: string; title: string }[];
}) {
  const t = useTranslations("instituteDashboard.students");
  const tc = useTranslations("instituteDashboard.common");
  const { refresh, isRefreshing, refreshStuck } = useDashboardRefresh();
  const [query, setQuery] = useState("");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [handledRequestIds, setHandledRequestIds] = useState<Set<string>>(new Set());
  const requests = initialRequests.filter((r) => !handledRequestIds.has(r.id));
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchByRequestId, setSelectedBatchByRequestId] = useState<Record<string, string>>({});
  const [declineReasonByRequestId, setDeclineReasonByRequestId] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.batch.toLowerCase().includes(q));
  }, [students, query]);

  const { currentPage, totalPages, setPage, offset, pageSize } = usePagination(filtered.length);
  const pagedStudents = filtered.slice(offset, offset + pageSize);

  async function handleRespond(id: string, accept: boolean) {
    setRespondingId(id);
    setError(null);
    const result = await respondToJoinRequest(
      id,
      accept,
      accept ? selectedBatchByRequestId[id] : undefined,
      accept ? undefined : declineReasonByRequestId[id],
    );
    setRespondingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setHandledRequestIds((prev) => new Set(prev).add(id));
    refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("heading")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={() => setShowBulkImport((v) => !v)}>
            {t("bulkImport.button")}
          </Button>
          <Input
            placeholder={t("searchPlaceholder")}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

      {showBulkImport && (
        <BulkImportPanel batchOptions={batchOptions} onDone={() => refresh()} onClose={() => setShowBulkImport(false)} />
      )}

      {requests.length > 0 && (
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-3 text-lg">{t("requests.heading")}</h3>
          {error && <p className="mb-3 text-sm font-medium text-destructive">{error}</p>}
          <div className="flex flex-col divide-y divide-border">
            {requests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div>
                  <p className="font-medium text-foreground">{request.studentName}</p>
                  <p className="text-sm text-muted-foreground">
                    {request.batch} · {request.requestedAt}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {request.batchId === null && batchOptions.length > 0 && (
                    <Select
                      value={selectedBatchByRequestId[request.id] ?? ""}
                      onValueChange={(value) =>
                        setSelectedBatchByRequestId((prev) => ({ ...prev, [request.id]: value ?? "" }))
                      }
                    >
                      <SelectTrigger className="h-8 w-44 text-xs">
                        <SelectValue placeholder={t("requests.assignBatchPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {batchOptions.map((batch) => (
                          <SelectItem key={batch.id} value={batch.id}>
                            {batch.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    placeholder={t("requests.declineReasonPlaceholder")}
                    value={declineReasonByRequestId[request.id] ?? ""}
                    onChange={(e) =>
                      setDeclineReasonByRequestId((prev) => ({ ...prev, [request.id]: e.target.value }))
                    }
                    className="h-8 w-44 text-xs"
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleRespond(request.id, true)}
                    disabled={respondingId === request.id}
                  >
                    {t("requests.accept")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleRespond(request.id, false)}
                    disabled={respondingId === request.id}
                  >
                    {t("requests.decline")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border bg-white p-5">
        {filtered.length === 0 ? (
          <p className="p-2 text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.student")}</TableHead>
                <TableHead>{t("columns.batch")}</TableHead>
                <TableHead>{t("columns.joined")}</TableHead>
                <TableHead>{t("columns.contact")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedStudents.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar>
                        <AvatarFallback className={avatarGradientClass(student.name)}>
                          {initialsFor(student.name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{student.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{student.batch}</TableCell>
                  <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                  <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {filtered.length > 0 && (
          <PaginationFooter
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            showingLabel={tc("pagination.showingCount", { shown: pagedStudents.length, total: filtered.length })}
            previousLabel={tc("pagination.previous")}
            nextLabel={tc("pagination.next")}
            pageInfoLabel={tc("pagination.pageInfo", { page: currentPage, totalPages })}
          />
        )}
      </div>
    </div>
  );
}

// One phone number per line — accepts a bare number or "Name, 077 123 4567"
// style rows (common when pasted straight out of a spreadsheet), pulling
// out the first run of digits/+/spaces/dashes long enough to be a phone
// number rather than requiring a strict single-column format.
function extractPhone(line: string): string | null {
  const match = line.match(/[+\d][\d\s-]{6,}/);
  return match ? match[0].replace(/[\s-]/g, "") : null;
}

function BulkImportPanel({
  batchOptions,
  onDone,
  onClose,
}: {
  batchOptions: { id: string; title: string }[];
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("instituteDashboard.students");
  const tc = useTranslations("instituteDashboard.common");
  const [batchId, setBatchId] = useState(batchOptions[0]?.id ?? "");
  const [raw, setRaw] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<BulkEnrollResult[] | null>(null);

  async function handleImport() {
    const phones = raw
      .split("\n")
      .map(extractPhone)
      .filter((p): p is string => Boolean(p));
    if (!batchId) {
      setError(t("bulkImport.batchRequired"));
      return;
    }
    if (phones.length === 0) {
      setError(t("bulkImport.noPhones"));
      return;
    }
    setSaving(true);
    setError(null);
    const outcome = await bulkEnrollStudentsByPhone(batchId, phones);
    setSaving(false);
    if (outcome.error) {
      setError(outcome.error);
      return;
    }
    setResults(outcome.results ?? []);
    onDone();
  }

  const enrolledCount = results?.filter((r) => r.result === "enrolled").length ?? 0;
  const alreadyCount = results?.filter((r) => r.result === "already_enrolled").length ?? 0;
  const notFoundPhones = results?.filter((r) => r.result === "not_found").map((r) => r.phone) ?? [];

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <h3 className="mb-1 text-lg">{t("bulkImport.title")}</h3>
      <p className="mb-4 text-sm text-muted-foreground">{t("bulkImport.subtitle")}</p>

      {results ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">
            {t("bulkImport.summary", { enrolled: enrolledCount, already: alreadyCount, notFound: notFoundPhones.length })}
          </p>
          {notFoundPhones.length > 0 && (
            <div className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              <p className="mb-1 font-medium text-foreground">{t("bulkImport.notFoundHeading")}</p>
              <p className="font-mono text-xs">{notFoundPhones.join(", ")}</p>
            </div>
          )}
          <div className="flex gap-3">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setResults(null);
                setRaw("");
              }}
            >
              {t("bulkImport.importMore")}
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              {tc("close")}
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>{t("bulkImport.batch")}</Label>
              <Select value={batchId} onValueChange={(value) => setBatchId(value ?? "")}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {batchOptions.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bulk-import-phones">{t("bulkImport.phonesLabel")}</Label>
              <textarea
                id="bulk-import-phones"
                className="min-h-32 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 font-mono text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                placeholder={t("bulkImport.phonesPlaceholder")}
              />
              <p className="text-xs text-muted-foreground">{t("bulkImport.phonesHint")}</p>
            </div>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-destructive">{error}</p>}
          <div className="mt-4 flex gap-3">
            <Button onClick={handleImport} disabled={saving || !batchId || !raw.trim()}>
              {saving ? t("bulkImport.importing") : t("bulkImport.submit")}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={saving}>
              {tc("cancel")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
