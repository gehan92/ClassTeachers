import { useTranslations } from "next-intl";
import { Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { StatusBadge } from "@/components/features/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { avatarGradientClass } from "@/lib/avatar-color";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import type { TeachersAtGlance } from "@/types/dashboard-institute";

export type RecentActivityItem =
  | { id: string; type: "ad"; title: string; dateLabel: string }
  | { id: string; type: "enrollment"; studentName: string; batchLabel: string; dateLabel: string }
  | { id: string; type: "review"; author: string; dateLabel: string };

export type PendingTeacherApproval = { id: string; name: string; subject: string };
export type PendingStudentApproval = { id: string; studentName: string; batchLabel: string };

function TimelineItem({ label, dateLabel, dotClassName }: { label: React.ReactNode; dateLabel: string; dotClassName?: string }) {
  return (
    <div className="flex gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className={`mt-1.5 size-2 shrink-0 rounded-full ${dotClassName ?? "bg-cta"}`} />
      <div className="text-sm">
        <p className="text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{dateLabel}</p>
      </div>
    </div>
  );
}

export function OverviewTab({
  instituteName,
  location,
  verified,
  teachersCount,
  studentsCount,
  batchesCount,
  revenueDisplay,
  teachersAtGlance,
  recentActivity,
  pendingTeacherApprovals,
  pendingStudentApprovals,
}: {
  instituteName: string;
  location: string;
  verified: boolean;
  teachersCount: number;
  studentsCount: number;
  batchesCount: number;
  /** "—" until a real number exists to show here (Finance feature isn't built yet). */
  revenueDisplay: string;
  teachersAtGlance: TeachersAtGlance[];
  recentActivity: RecentActivityItem[];
  pendingTeacherApprovals: PendingTeacherApproval[];
  pendingStudentApprovals: PendingStudentApproval[];
}) {
  const t = useTranslations("instituteDashboard.overview");

  return (
    <div className="flex flex-col gap-6">
      <DashboardHero
        title={instituteName}
        badge={verified ? `✓ ${t("hero.verified")}` : undefined}
        subtitle={`${t("subtitle")}${location ? ` · ${location}` : ""}`}
        actions={[
          { label: t("hero.createClass"), href: { pathname: "/institute", query: { tab: "batches" } } },
          { label: t("hero.approveTeacher"), href: { pathname: "/institute", query: { tab: "teachers" } } },
          { label: t("hero.postAd"), href: { pathname: "/institute", query: { tab: "ads" } }, variant: "cta" },
        ]}
        stats={[
          { label: t("stats.classes"), value: batchesCount, href: { pathname: "/institute", query: { tab: "batches" } } },
          { label: t("stats.teachers"), value: teachersCount, href: { pathname: "/institute", query: { tab: "teachers" } } },
          { label: t("stats.students"), value: studentsCount, href: { pathname: "/institute", query: { tab: "students" } } },
          { label: t("stats.revenue"), value: revenueDisplay, href: { pathname: "/institute", query: { tab: "finance" } } },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-5">
          <h3 className="mb-2 text-lg">{t("activity.title")}</h3>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("activity.empty")}</p>
          ) : (
            recentActivity.map((item) => (
              <TimelineItem
                key={item.id}
                dateLabel={item.dateLabel}
                label={
                  item.type === "ad"
                    ? t("activity.postedAd", { title: item.title })
                    : item.type === "enrollment"
                      ? t("activity.enrolled", { name: item.studentName, batch: item.batchLabel })
                      : t("activity.newReview", { author: item.author })
                }
              />
            ))
          )}
        </div>
        <div className="rounded-lg border border-border bg-white p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-lg">{t("approvals.title")}</h3>
            <Link href={{ pathname: "/institute", query: { tab: "teachers" } }} className="text-sm font-medium text-accent-deep hover:underline">
              {t("approvals.viewAll")}
            </Link>
          </div>
          {pendingTeacherApprovals.length === 0 && pendingStudentApprovals.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("approvals.empty")}</p>
          ) : (
            <>
              {pendingTeacherApprovals.map((row) => (
                <TimelineItem
                  key={`teacher-${row.id}`}
                  label={t("approvals.teacherApplication", { name: row.name }) + (row.subject ? ` (${row.subject})` : "")}
                  dateLabel={t("approvals.awaitingReview")}
                />
              ))}
              {pendingStudentApprovals.map((row) => (
                <TimelineItem
                  key={`student-${row.id}`}
                  label={t("approvals.studentRequest", { name: row.studentName, batch: row.batchLabel })}
                  dateLabel={t("approvals.awaitingReview")}
                />
              ))}
            </>
          )}
        </div>
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
