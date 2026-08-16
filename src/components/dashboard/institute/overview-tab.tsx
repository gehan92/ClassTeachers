import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StatCard } from "@/components/dashboard/stat-card";
import { StatusBadge } from "@/components/features/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { avatarGradientClass } from "@/lib/avatar-color";
import type { TeachersAtGlance } from "@/types/dashboard-institute";

export function OverviewTab({
  instituteName,
  teachersCount,
  studentsCount,
  averageRating,
  batchesCount,
  teachersAtGlance,
}: {
  instituteName: string;
  teachersCount: number;
  studentsCount: number;
  averageRating: string | null;
  batchesCount: number;
  teachersAtGlance: TeachersAtGlance[];
}) {
  const t = useTranslations("instituteDashboard.overview");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{instituteName}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href={{ pathname: "/institute", query: { tab: "teachers" } }}
          className="inline-flex items-center rounded-sm bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light"
        >
          {t("inviteTeacher")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={t("stats.teachers")} value={teachersCount} />
        <StatCard label={t("stats.students")} value={studentsCount} />
        <StatCard label={t("stats.rating")} value={averageRating ?? "—"} />
        <StatCard label={t("stats.batches")} value={batchesCount} />
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        <h3 className="mb-4 text-lg">{t("glanceTitle")}</h3>
        {teachersAtGlance.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("glanceEmpty")}</p>
        ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("table.teacher")}</TableHead>
              <TableHead>{t("table.subject")}</TableHead>
              <TableHead>{t("table.students")}</TableHead>
              <TableHead>{t("table.rating")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teachersAtGlance.map((teacher) => (
              <TableRow key={teacher.name}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar>
                      <AvatarFallback className={avatarGradientClass(teacher.name)}>
                        {teacher.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium text-foreground">{teacher.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{teacher.subject}</TableCell>
                <TableCell>{teacher.studentCount}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3.5 text-cta" fill="currentColor" />
                    {teacher.rating}
                  </span>
                </TableCell>
                <TableCell>
                  {teacher.status === "active" ? (
                    <StatusBadge variant="active">{t("table.active")}</StatusBadge>
                  ) : (
                    <StatusBadge variant="pending">{teacher.statusNote}</StatusBadge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}
