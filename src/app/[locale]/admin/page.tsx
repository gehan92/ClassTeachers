import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/admin/overview-tab";
import { ApprovalsTab } from "@/components/dashboard/admin/approvals-tab";
import { UsersTab } from "@/components/dashboard/admin/users-tab";
import { SubscriptionsTab } from "@/components/dashboard/admin/subscriptions-tab";
import { SiteAdsTab } from "@/components/dashboard/admin/site-ads-tab";
import { FlaggedReviewsTab } from "@/components/dashboard/admin/flagged-reviews-tab";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { roleDashboardPath } from "@/lib/auth/routes";
import type {
  ApprovalEntityType,
  FlaggedReview,
  PendingApproval,
  PlatformUser,
  PlatformUserRole,
  SiteAd,
} from "@/types/dashboard-admin";

function isCurrentlyBanned(bannedUntil: string | null | undefined): boolean {
  return Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());
}

function isWithinDays(isoDate: string | null, days: number): boolean {
  if (!isoDate) return false;
  return new Date(isoDate).getTime() <= Date.now() + days * 24 * 60 * 60 * 1000;
}

function isWithinPastDays(isoDate: string, days: number): boolean {
  return new Date(isoDate).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

export default async function AdminDashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("adminDashboard");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts only checks that a session exists, not the role — unlike
  // student/teacher/institute (where a wrong-role visitor just sees their
  // own empty data), admin tabs are meant to expose every user's data, so
  // this route needs its own explicit role check rather than relying on
  // table-level scoping to make cross-role access harmless.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    redirect(`/${locale}${roleDashboardPath[profile?.role ?? "student"]}`);
  }

  const userInitial = profile.full_name.charAt(0).toUpperCase();

  const [{ data: pendingTeacherRows }, { data: pendingClassRows }] = await Promise.all([
    supabase
      .from("teacher_profiles")
      .select("id, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
    supabase
      .from("class_profiles")
      .select("id, name, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const pendingTeacherIds = (pendingTeacherRows ?? []).map((row) => row.id);
  const { data: pendingTeacherProfiles } = pendingTeacherIds.length
    ? await supabase.from("profiles").select("id, full_name, role").in("id", pendingTeacherIds)
    : { data: [] as { id: string; full_name: string; role: string }[] };
  const teacherProfileById = new Map((pendingTeacherProfiles ?? []).map((p) => [p.id, p]));

  const dateFormatter = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });

  const approvals: PendingApproval[] = [
    ...(pendingTeacherRows ?? []).map((row) => {
      const owner = teacherProfileById.get(row.id);
      return {
        id: row.id,
        name: owner?.full_name ?? "—",
        entityType: (owner?.role === "campus_lecturer" ? "campus_lecturer" : "teacher") as ApprovalEntityType,
        submittedAt: dateFormatter.format(new Date(row.created_at)),
      };
    }),
    ...(pendingClassRows ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      entityType: "institute" as ApprovalEntityType,
      submittedAt: dateFormatter.format(new Date(row.created_at)),
    })),
  ];

  // Excludes 'admin' — the Users tab manages platform accounts, not other
  // admins. 'class' is the DB role; every other admin-tab label already
  // says "institute" instead, so it's mapped the same way here.
  const platformRoleByDbRole: Partial<Record<string, PlatformUserRole>> = {
    student: "student",
    teacher: "teacher",
    class: "institute",
    campus_lecturer: "campus_lecturer",
  };

  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: false });

  // banned_until lives on auth.users, not profiles — requires the
  // service-role client (src/lib/supabase/admin.ts) to read.
  const supabaseAdmin = createAdminClient();
  const { data: authUsersPage } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  const bannedUntilById = new Map(authUsersPage?.users.map((u) => [u.id, u.banned_until]) ?? []);

  const platformUsers: PlatformUser[] = (allProfiles ?? [])
    .map((p) => {
      const platformRole = platformRoleByDbRole[p.role];
      if (!platformRole) return null;
      const suspended = isCurrentlyBanned(bannedUntilById.get(p.id));
      return {
        id: p.id,
        name: p.full_name,
        role: platformRole,
        joinedAt: dateFormatter.format(new Date(p.created_at)),
        status: suspended ? "suspended" : "active",
      } satisfies PlatformUser;
    })
    .filter((u): u is PlatformUser => u !== null);

  const { data: siteAdRows } = await supabase
    .from("advertisements")
    .select("id, title, plan, placement, status, expires_at")
    .eq("owner_type", "site")
    .eq("status", "active")
    .order("expires_at", { ascending: true, nullsFirst: false });

  const siteAds: SiteAd[] = (siteAdRows ?? []).map((row) => ({
    id: row.id,
    sponsor: row.title,
    plan: row.plan as SiteAd["plan"],
    placement: row.placement as SiteAd["placement"],
    expiresDisplay: row.expires_at ? dateFormatter.format(new Date(row.expires_at)) : t("siteAds.noExpiry"),
    status: isWithinDays(row.expires_at, 7) ? "expiring" : "live",
  }));

  const { data: flaggedReviewRows } = await supabase
    .from("reviews")
    .select("id, target_type, target_id, rating, comment, created_at")
    .eq("is_flagged", true)
    .order("created_at", { ascending: false });

  const flaggedTeacherIds = (flaggedReviewRows ?? [])
    .filter((r) => r.target_type !== "class")
    .map((r) => r.target_id);
  const flaggedClassIds = (flaggedReviewRows ?? []).filter((r) => r.target_type === "class").map((r) => r.target_id);

  const [{ data: flaggedTeacherProfiles }, { data: flaggedClassProfiles }] = await Promise.all([
    flaggedTeacherIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", flaggedTeacherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    flaggedClassIds.length
      ? supabase.from("class_profiles").select("id, name").in("id", flaggedClassIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);
  const teacherNameById = new Map((flaggedTeacherProfiles ?? []).map((p) => [p.id, p.full_name]));
  const classNameById = new Map((flaggedClassProfiles ?? []).map((p) => [p.id, p.name]));

  const flaggedReviews: FlaggedReview[] = (flaggedReviewRows ?? []).map((row) => {
    const targetName =
      (row.target_type === "class" ? classNameById.get(row.target_id) : teacherNameById.get(row.target_id)) ?? "—";
    return {
      id: row.id,
      targetLabel: t("flagged.targetLabel", { name: targetName }),
      flaggedAt: dateFormatter.format(new Date(row.created_at)),
      rating: row.rating,
      body: row.comment ?? "",
    };
  });

  const [{ data: subscriptionRows }, { data: settingsRows }, { data: teacherProfileRows }, { data: classProfileRows }] =
    await Promise.all([
      supabase.from("platform_subscriptions").select("plan, status, updated_at"),
      supabase.from("platform_settings").select("key, value").in("key", ["standard_price", "premium_price"]),
      supabase.from("teacher_profiles").select("id, created_at"),
      supabase.from("class_profiles").select("id, created_at"),
    ]);

  const settingValue = (key: string, fallback: string) =>
    settingsRows?.find((s) => s.key === key)?.value ?? fallback;
  const standardPrice = settingValue("standard_price", "2500");
  const premiumPrice = settingValue("premium_price", "4900");

  const activeStandardCount = (subscriptionRows ?? []).filter(
    (s) => s.plan === "standard" && s.status === "active",
  ).length;
  const activePremiumCount = (subscriptionRows ?? []).filter(
    (s) => s.plan === "premium" && s.status === "active",
  ).length;
  const teacherCount = teacherProfileRows?.length ?? 0;
  const classCount = classProfileRows?.length ?? 0;
  const totalOwners = teacherCount + classCount;
  const freeCount = Math.max(totalOwners - activeStandardCount - activePremiumCount, 0);

  const canceled30d = (subscriptionRows ?? []).filter(
    (s) => s.status === "canceled" && isWithinPastDays(s.updated_at, 30),
  ).length;
  const everPaidCount = activeStandardCount + activePremiumCount + canceled30d;
  const churnRate = everPaidCount > 0 ? (canceled30d / everPaidCount) * 100 : 0;

  const currencyFormatter = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const standardMrr = activeStandardCount * Number(standardPrice);
  const premiumMrr = activePremiumCount * Number(premiumPrice);

  const studentProfiles = (allProfiles ?? []).filter((p) => p.role === "student");
  const studentsCount = studentProfiles.length;
  const teachersDelta = (teacherProfileRows ?? []).filter((r) => isWithinPastDays(r.created_at, 7)).length;
  const institutesDelta = (classProfileRows ?? []).filter((r) => isWithinPastDays(r.created_at, 7)).length;
  const studentsDelta = studentProfiles.filter((p) => isWithinPastDays(p.created_at, 7)).length;

  const expiringSiteAds = siteAds.filter((ad) => ad.status === "expiring");
  const nextExpiringAd = expiringSiteAds[0]
    ? { sponsor: expiringSiteAds[0].sponsor, expiresDisplay: expiringSiteAds[0].expiresDisplay }
    : null;

  return (
    <DashboardShell
      brandBadge="ADMIN"
      userLabel={profile.full_name}
      userInitial={userInitial}
      logoutLabel={t("logout")}
      demoRole="admin"
      groups={[
        {
          label: t("groupPlatform"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "approvals", label: t("tabs.approvals"), count: approvals.length },
            { key: "users", label: t("tabs.users") },
          ],
        },
        {
          label: t("groupMonetization"),
          items: [
            { key: "subscriptions", label: t("tabs.subscriptions") },
            { key: "siteAds", label: t("tabs.siteAds") },
          ],
        },
        {
          label: t("groupTrust"),
          items: [{ key: "flagged", label: t("tabs.flagged"), count: flaggedReviews.length }],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            teachersCount={teacherCount}
            teachersDelta={teachersDelta}
            institutesCount={classCount}
            institutesDelta={institutesDelta}
            studentsCount={studentsCount}
            studentsDelta={studentsDelta}
            revenueDisplay={`Rs. ${currencyFormatter.format(standardMrr + premiumMrr)}`}
            pendingApprovalsCount={approvals.length}
            flaggedCount={flaggedReviews.length}
            expiringAdsCount={expiringSiteAds.length}
            nextExpiringAd={nextExpiringAd}
          />
        ),
        approvals: <ApprovalsTab initialApprovals={approvals} />,
        users: <UsersTab initialUsers={platformUsers} />,
        subscriptions: (
          <SubscriptionsTab
            freeCount={freeCount}
            standardCount={activeStandardCount}
            premiumCount={activePremiumCount}
            standardMrrDisplay={`Rs. ${currencyFormatter.format(standardMrr)}`}
            premiumMrrDisplay={`Rs. ${currencyFormatter.format(premiumMrr)}`}
            churnDisplay={`${churnRate.toFixed(1)}%`}
            initialStandardPrice={standardPrice}
            initialPremiumPrice={premiumPrice}
          />
        ),
        siteAds: <SiteAdsTab initialAds={siteAds} />,
        flagged: <FlaggedReviewsTab initialReviews={flaggedReviews} />,
      }}
      defaultTab="overview"
    />
  );
}
