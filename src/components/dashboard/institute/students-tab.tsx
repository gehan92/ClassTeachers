"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { avatarGradientClass } from "@/lib/avatar-color";
import { RefreshStatus } from "@/components/dashboard/refresh-status";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { respondToJoinRequest } from "@/lib/dashboard/batches-actions";

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
  const [handledRequestIds, setHandledRequestIds] = useState<Set<string>>(new Set());
  const requests = initialRequests.filter((r) => !handledRequestIds.has(r.id));
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedBatchByRequestId, setSelectedBatchByRequestId] = useState<Record<string, string>>({});

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter((s) => s.name.toLowerCase().includes(q) || s.batch.toLowerCase().includes(q));
  }, [students, query]);

  async function handleRespond(id: string, accept: boolean) {
    setRespondingId(id);
    setError(null);
    const result = await respondToJoinRequest(id, accept, accept ? selectedBatchByRequestId[id] : undefined);
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
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl">{t("heading")}</h1>
        <Input
          placeholder={t("searchPlaceholder")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full sm:w-64"
        />
      </div>

      <RefreshStatus
        pending={isRefreshing}
        stuck={refreshStuck}
        pendingLabel={tc("updatingList")}
        stuckLabel={tc("updateStuck")}
        reloadLabel={tc("reloadPage")}
      />

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
              {filtered.map((student) => (
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
      </div>
    </div>
  );
}
