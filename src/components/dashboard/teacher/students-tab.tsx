"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { avatarGradientClass } from "@/lib/avatar-color";
import { respondToJoinRequest } from "@/lib/dashboard/batches-actions";

export type TeacherStudentRow = {
  id: string;
  name: string;
  batch: string;
  joinedAt: string;
  phone: string | null;
};

export type TeacherJoinRequestRow = {
  id: string;
  studentName: string;
  batch: string;
  requestedAt: string;
};

export function StudentsTab({
  students,
  requests: initialRequests,
}: {
  students: TeacherStudentRow[];
  requests: TeacherJoinRequestRow[];
}) {
  const t = useTranslations("teacherDashboard.students");
  const [query, setQuery] = useState("");
  const [requests, setRequests] = useState(initialRequests);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(q) || s.batch.toLowerCase().includes(q),
    );
  }, [students, query]);

  async function handleRespond(id: string, accept: boolean) {
    setRespondingId(id);
    setError(null);
    const result = await respondToJoinRequest(id, accept);
    setRespondingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRequests((list) => list.filter((r) => r.id !== id));
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
                <div className="flex gap-2">
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
                    <Avatar size="sm">
                      <AvatarFallback className={avatarGradientClass(student.name)}>
                        {student.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{student.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{student.batch}</TableCell>
                <TableCell className="text-muted-foreground">{student.joinedAt}</TableCell>
                <TableCell className="text-muted-foreground">{student.phone}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
