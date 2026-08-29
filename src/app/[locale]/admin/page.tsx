import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { OverviewTab } from "@/components/dashboard/admin/overview-tab";
import { ApprovalsTab } from "@/components/dashboard/admin/approvals-tab";
import { UsersTab } from "@/components/dashboard/admin/users-tab";
import { SubscriptionsTab } from "@/components/dashboard/admin/subscriptions-tab";
import { SiteAdsTab } from "@/components/dashboard/admin/site-ads-tab";
import { FlaggedReviewsTab } from "@/components/dashboard/admin/flagged-reviews-tab";
import { ConnectionsTab } from "@/components/dashboard/admin/connections-tab";
import { ReferralsTab } from "@/components/dashboard/admin/referrals-tab";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDateFormatter } from "@/lib/format-date";
import { roleDashboardPath } from "@/lib/auth/routes";
import type {
  AdminReferral,
  ApprovalEntityType,
  ConnectionInquiry,
  ConnectionJoinRequest,
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
  // table-level scoping to make cross-role access harmless. This has to
  // stay a standalone, first query — every other query below (especially
  // the service-role listUsers call, which bypasses RLS entirely) must not
  // run until this redirect decision is made.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user!.id)
    .single();

  if (profile?.role !== "admin") {
    redirect(`/${locale}${roleDashboardPath[profile?.role ?? "student"]}`);
  }

  const userInitial = profile.full_name.charAt(0).toUpperCase();
  const dateFormatter = createDateFormatter(locale);

  // Stage 1 — every query below is independent of the others (none needs
  // another's result), so they all run as one batch instead of a chain of
  // sequential round trips. This function re-runs in full on every page
  // load AND every router.refresh() after a mutation (see
  // useDashboardRefresh), so collapsing that chain here is what actually
  // makes the dashboard feel fast rather than just showing a loading
  // indicator sooner.
  const supabaseAdmin = createAdminClient();
  const [
    { data: pendingTeacherRows },
    { data: pendingClassRows },
    { data: allProfiles },
    { data: authUsersPage },
    { data: siteAdRows },
    { data: flaggedReviewRows },
    { data: recentInquiryRows },
    { data: recentEnrollmentRows },
    { data: subscriptionRows },
    { data: settingsRows },
    { data: teacherProfileRows },
    { data: classProfileRows },
    { data: referralRows },
  ] = await Promise.all([
    supabase.from("teacher_profiles").select("id, created_at").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("class_profiles").select("id, name, created_at").eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, role, created_at").order("created_at", { ascending: false }),
    // banned_until lives on auth.users, not profiles — requires the
    // service-role client (src/lib/supabase/admin.ts) to read.
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
    supabase
      .from("advertisements")
      .select("id, title, plan, placement, status, expires_at")
      .eq("owner_type", "site")
      .eq("status", "active")
      .order("expires_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("reviews")
      .select("id, target_type, target_id, rating, comment, created_at")
      .eq("is_flagged", true)
      .order("created_at", { ascending: false }),
    // Read-only oversight of first contact between students and
    // teachers/institutes — inquiries and join requests already have
    // is_admin() in their SELECT policies (0037, 0013), so this is a plain
    // query, no new RLS/RPC needed. Capped at the 50 most recent of each.
    supabase
      .from("inquiries")
      .select("id, owner_type, owner_id, sender_name, sender_contact, message, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("enrollments")
      .select("id, student_id, owner_type, owner_id, status, joined_at")
      .order("joined_at", { ascending: false })
      .limit(50),
    supabase.from("platform_subscriptions").select("plan, status, updated_at"),
    supabase.from("platform_settings").select("key, value").in("key", ["standard_price", "premium_price"]),
    supabase.from("teacher_profiles").select("id, created_at, institution_verified, verification_document_path"),
    supabase
      .from("class_profiles")
      .select("id, created_at, owner_id, institution_verified, verification_document_path"),
    // referrals' own SELECT policy (0089) already covers "referrer_id =
    // auth.uid() or is_admin()" — this admin session sees every row
    // directly, no RPC needed, same as the inquiries/enrollments oversight
    // queries above.
    supabase
      .from("referrals")
      .select("id, referrer_id, referred_id, reward_status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const pendingTeacherIds = (pendingTeacherRows ?? []).map((row) => row.id);
  const flaggedTeacherIds = (flaggedReviewRows ?? []).filter((r) => r.target_type !== "class").map((r) => r.target_id);
  const flaggedClassIds = (flaggedReviewRows ?? []).filter((r) => r.target_type === "class").map((r) => r.target_id);
  const connectionClassIds = [
    ...new Set([
      ...(recentInquiryRows ?? []).filter((r) => r.owner_type === "class").map((r) => r.owner_id),
      ...(recentEnrollmentRows ?? []).filter((r) => r.owner_type === "class").map((r) => r.owner_id),
    ]),
  ];

  // Stage 2 — everything here needs a stage-1 result, but nothing here
  // depends on anything else in this stage.
  const [
    { data: pendingTeacherProfiles },
    { data: flaggedTeacherProfiles },
    { data: flaggedClassProfiles },
    { data: connectionClassRows },
  ] = await Promise.all([
    pendingTeacherIds.length
      ? supabase.from("profiles").select("id, full_name, role").in("id", pendingTeacherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string; role: string }[] }),
    flaggedTeacherIds.length
      ? supabase.from("profiles").select("id, full_name").in("id", flaggedTeacherIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    flaggedClassIds.length
      ? supabase.from("class_profiles").select("id, name").in("id", flaggedClassIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    connectionClassIds.length
      ? supabase.from("class_profiles").select("id, name").in("id", connectionClassIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  // Everything below is pure computation over already-fetched data — no
  // more round trips from here on.

  const teacherProfileById = new Map((pendingTeacherProfiles ?? []).map((p) => [p.id, p]));

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

  const bannedUntilById = new Map(authUsersPage?.users.map((u) => [u.id, u.banned_until]) ?? []);
  // Verification (0075/0076, extended to every teacher/institute by 0087) —
  // teacher_profiles.id already equals the owner's profiles.id, but
  // class_profiles has its own primary key, so the institute lookup goes
  // through owner_id instead.
  const institutionVerifiedById = new Map((teacherProfileRows ?? []).map((tp) => [tp.id, tp.institution_verified]));
  const hasVerificationDocumentById = new Map(
    (teacherProfileRows ?? []).map((tp) => [tp.id, tp.verification_document_path !== null]),
  );
  const classVerifiedByOwnerId = new Map((classProfileRows ?? []).map((cp) => [cp.owner_id, cp.institution_verified]));
  const classHasDocumentByOwnerId = new Map(
    (classProfileRows ?? []).map((cp) => [cp.owner_id, cp.verification_document_path !== null]),
  );

  const platformUsers: PlatformUser[] = (allProfiles ?? [])
    .map((p) => {
      const platformRole = platformRoleByDbRole[p.role];
      if (!platformRole) return null;
      const suspended = isCurrentlyBanned(bannedUntilById.get(p.id));
      const isInstitute = platformRole === "institute";
      return {
        id: p.id,
        name: p.full_name,
        role: platformRole,
        joinedAt: dateFormatter.format(new Date(p.created_at)),
        status: suspended ? "suspended" : "active",
        institutionVerified:
          platformRole === "student"
            ? undefined
            : ((isInstitute ? classVerifiedByOwnerId.get(p.id) : institutionVerifiedById.get(p.id)) ?? false),
        hasVerificationDocument:
          platformRole === "student"
            ? undefined
            : ((isInstitute ? classHasDocumentByOwnerId.get(p.id) : hasVerificationDocumentById.get(p.id)) ?? false),
      } satisfies PlatformUser;
    })
    .filter((u): u is PlatformUser => u !== null);

  const siteAds: SiteAd[] = (siteAdRows ?? []).map((row) => ({
    id: row.id,
    sponsor: row.title,
    plan: row.plan as SiteAd["plan"],
    placement: row.placement as SiteAd["placement"],
    expiresDisplay: row.expires_at ? dateFormatter.format(new Date(row.expires_at)) : t("siteAds.noExpiry"),
    status: isWithinDays(row.expires_at, 7) ? "expiring" : "live",
  }));

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

  const profileNameById = new Map((allProfiles ?? []).map((p) => [p.id, p.full_name]));
  const connectionClassNameById = new Map((connectionClassRows ?? []).map((c) => [c.id, c.name]));

  function connectionOwnerLabel(ownerType: string, ownerId: string): string {
    return ownerType === "class" ? (connectionClassNameById.get(ownerId) ?? "—") : (profileNameById.get(ownerId) ?? "—");
  }

  const connectionInquiries: ConnectionInquiry[] = (recentInquiryRows ?? []).map((row) => ({
    id: row.id,
    senderName: row.sender_name,
    senderContact: row.sender_contact,
    targetLabel: connectionOwnerLabel(row.owner_type, row.owner_id),
    message: row.message,
    status: row.status,
    createdAt: dateFormatter.format(new Date(row.created_at)),
  }));

  const connectionRequests: ConnectionJoinRequest[] = (recentEnrollmentRows ?? []).map((row) => ({
    id: row.id,
    studentName: profileNameById.get(row.student_id) ?? "—",
    targetLabel: connectionOwnerLabel(row.owner_type, row.owner_id),
    status: row.status,
    createdAt: dateFormatter.format(new Date(row.joined_at)),
  }));

  const referrals: AdminReferral[] = (referralRows ?? []).map((row) => ({
    id: row.id,
    referrerName: profileNameById.get(row.referrer_id) ?? "—",
    referredName: profileNameById.get(row.referred_id) ?? "—",
    rewardStatus: row.reward_status,
    createdAt: dateFormatter.format(new Date(row.created_at)),
  }));

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
            {
              key: "referrals",
              label: t("tabs.referrals"),
              count: referrals.filter((r) => r.rewardStatus === "pending").length,
            },
          ],
        },
        {
          label: t("groupTrust"),
          items: [
            { key: "flagged", label: t("tabs.flagged"), count: flaggedReviews.length },
            { key: "connections", label: t("tabs.connections") },
          ],
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
        referrals: <ReferralsTab initialReferrals={referrals} />,
        flagged: <FlaggedReviewsTab initialReviews={flaggedReviews} />,
        connections: <ConnectionsTab inquiries={connectionInquiries} requests={connectionRequests} />,
      }}
      defaultTab="overview"
    />
  );
}
