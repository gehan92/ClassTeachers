import { redirect } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import { OverviewTab } from "@/components/dashboard/admin/overview-tab";
import { ApprovalsTab } from "@/components/dashboard/admin/approvals-tab";
import { UsersTab } from "@/components/dashboard/admin/users-tab";
import { SubscriptionsTab } from "@/components/dashboard/admin/subscriptions-tab";
import { SiteAdsTab } from "@/components/dashboard/admin/site-ads-tab";
import { FlaggedReviewsTab } from "@/components/dashboard/admin/flagged-reviews-tab";
import { ConnectionsTab } from "@/components/dashboard/admin/connections-tab";
import { ReferralsTab } from "@/components/dashboard/admin/referrals-tab";
import { PaymentsTab } from "@/components/dashboard/admin/payments-tab";
import { AuditLogTab } from "@/components/dashboard/admin/audit-log-tab";
import { PlatformSwitchesTab } from "@/components/dashboard/admin/platform-switches-tab";
import { ModerationTab } from "@/components/dashboard/admin/moderation-tab";
import { GrowthTab } from "@/components/dashboard/admin/growth-tab";
import { EarningsTab } from "@/components/dashboard/admin/earnings-tab";
import { ActivityTab } from "@/components/dashboard/admin/activity-tab";
import { TrafficTab } from "@/components/dashboard/admin/traffic-tab";
import { ReportsTab } from "@/components/dashboard/admin/reports-tab";
import { loadAdminReports } from "@/lib/dashboard/admin-reports";
import { loadTrafficReport } from "@/lib/dashboard/admin-insights-actions";
import { ANNOUNCEMENT_KEYS, getSiteAnnouncement } from "@/lib/site-announcement";
import { PLATFORM_FEATURES, featureSettingKey } from "@/lib/platform-features";
import { createClient } from "@/lib/supabase/server";
import { getNavAvailability } from "@/lib/nav-availability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createDateFormatter } from "@/lib/format-date";
import { roleDashboardPath } from "@/lib/auth/routes";
import type {
  AdminContentReport,
  ApprovalDecision,
  AdminPayment,
  AuditLogEntry,
  ModerationItem,
  PlatformFeatureState,
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
    { data: notificationRows },
    { data: paymentRows },
    { data: auditRows },
    { data: moderationNoteRows },
    { data: moderationExamRows },
    { data: moderationAssignmentRows },
    { data: moderationAdRows },
    { data: moderationWantedRows },
    { data: contentReportRows },
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
    supabase
      .from("platform_settings")
      .select("key, value")
      .in("key", ["standard_price", "premium_price", ...ANNOUNCEMENT_KEYS, ...PLATFORM_FEATURES.map(featureSettingKey)]),
    supabase.from("teacher_profiles").select("id, created_at, institution_verified, verification_document_path"),
    supabase
      .from("class_profiles")
      .select("id, name, created_at, owner_id, institution_verified, verification_document_path"),
    // referrals' own SELECT policy (0089) already covers "referrer_id =
    // auth.uid() or is_admin()" — this admin session sees every row
    // directly, no RPC needed, same as the inquiries/enrollments oversight
    // queries above.
    supabase
      .from("referrals")
      .select("id, referrer_id, referred_id, reward_status, created_at")
      .order("created_at", { ascending: false }),
    supabase.rpc("list_my_notifications"),
    // platform_payments' SELECT policy (0147) already grants admin every
    // row — the real PayHere money trail, newest first.
    supabase
      .from("platform_payments")
      .select("id, student_id, purpose, enrollment_id, institute_id, amount, currency, payhere_order_id, status, paid_at, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase
      .from("audit_log")
      .select("id, actor_id, action, target_type, target_id, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    // Admin -> Content: the newest teacher/institute content and student
    // requests. Every one of these tables already grants admin read access
    // in RLS (is_admin() / can_manage_content), so these are plain selects.
    supabase
      .from("notes")
      .select("id, owner_type, owner_id, title, note_type, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("exams")
      .select("id, owner_type, owner_id, title, published, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("assignments")
      .select("id, owner_type, owner_id, title, assignment_type, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("advertisements")
      .select("id, owner_type, owner_id, title, status, created_at")
      .in("owner_type", ["teacher", "class"])
      .in("status", ["active", "removed"])
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("wanted_ads")
      .select("id, student_id, title, status, created_at")
      .order("created_at", { ascending: false })
      .limit(200),
    // User reports (0165). Before that migration runs this just errors and
    // comes back empty, so the Reports tab shows "nothing reported".
    supabase
      .from("content_reports")
      .select("id, reporter_id, target_type, target_id, reason, details, status, resolution_note, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);

  const notifications: NotificationRow[] = (notificationRows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    data: (n.data as Record<string, unknown>) ?? {},
    tab: n.tab,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  const pendingTeacherIds = (pendingTeacherRows ?? []).map((row) => row.id);
  const flaggedTeacherIds = (flaggedReviewRows ?? []).filter((r) => r.target_type !== "class").map((r) => r.target_id);
  const flaggedClassIds = (flaggedReviewRows ?? []).filter((r) => r.target_type === "class").map((r) => r.target_id);
  const paymentEnrollmentIds = [
    ...new Set((paymentRows ?? []).map((p) => p.enrollment_id).filter((id): id is string => Boolean(id))),
  ];
  const reportIds = (type: string) =>
    [...new Set((contentReportRows ?? []).filter((r) => r.target_type === type).map((r) => r.target_id))];
  const reportedAdIds = reportIds("ad");
  const reportedWantedIds = reportIds("wanted_ad");
  const reportedReviewIds = reportIds("review");
  const reportedInstituteIds = reportIds("institute");
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
    { data: paymentEnrollmentRows },
    reports,
    { report: trafficYear },
    { report: trafficMonth },
    { data: reportedAdRows },
    { data: reportedWantedRows },
    { data: reportedReviewRows },
    { data: reportedInstituteRows },
    announcement,
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
    paymentEnrollmentIds.length
      ? supabase.from("enrollments").select("id, owner_type, owner_id").in("id", paymentEnrollmentIds)
      : Promise.resolve({ data: [] as { id: string; owner_type: string; owner_id: string }[] }),
    // Charts for Overview / Growth / Earnings / Activity (no tracking needed).
    loadAdminReports(supabaseAdmin, authUsersPage?.users ?? []),
    // Visits: 12 months for the Overview trend, 30 days for the Traffic tab.
    loadTrafficReport(365),
    loadTrafficReport(30),
    reportedAdIds.length
      ? supabase.from("advertisements").select("id, title").in("id", reportedAdIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    reportedWantedIds.length
      ? supabase.from("wanted_ads").select("id, title").in("id", reportedWantedIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    reportedReviewIds.length
      ? supabase.from("reviews").select("id, target_type, target_id, comment").in("id", reportedReviewIds)
      : Promise.resolve({ data: [] as { id: string; target_type: string; target_id: string; comment: string | null }[] }),
    reportedInstituteIds.length
      ? supabase.from("class_profiles").select("id, name").in("id", reportedInstituteIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    getSiteAnnouncement(),
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

  const lastSignInById = new Map(authUsersPage?.users.map((u) => [u.id, u.last_sign_in_at ?? null]) ?? []);
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
        lastActive: lastSignInById.get(p.id) ? dateFormatter.format(new Date(lastSignInById.get(p.id)!)) : null,
        lastActiveIso: lastSignInById.get(p.id) ?? null,
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

  const allClassNameById = new Map((classProfileRows ?? []).map((c) => [c.id, c.name]));
  const enrollmentOwnerById = new Map((paymentEnrollmentRows ?? []).map((e) => [e.id, e]));

  const payments: AdminPayment[] = (paymentRows ?? []).map((row) => {
    const enrollment = row.enrollment_id ? enrollmentOwnerById.get(row.enrollment_id) : undefined;
    const targetLabel = row.institute_id
      ? (allClassNameById.get(row.institute_id) ?? "—")
      : enrollment
        ? enrollment.owner_type === "class"
          ? (allClassNameById.get(enrollment.owner_id) ?? "—")
          : (profileNameById.get(enrollment.owner_id) ?? "—")
        : "—";
    return {
      id: row.id,
      studentName: profileNameById.get(row.student_id) ?? "—",
      purpose: row.purpose,
      targetLabel,
      amount: Number(row.amount),
      currency: row.currency,
      orderId: row.payhere_order_id,
      status: row.status,
      createdAt: dateFormatter.format(new Date(row.created_at)),
      createdAtIso: row.created_at,
      paidAt: row.paid_at ? dateFormatter.format(new Date(row.paid_at)) : null,
    };
  });

  // Turns audit_log.metadata into a short readable line — only the keys
  // admin actions actually write, so nothing internal leaks into the view.
  function auditDetails(metadata: unknown): string {
    if (!metadata || typeof metadata !== "object") return "";
    const m = metadata as Record<string, unknown>;
    const parts: string[] = [];
    for (const key of ["title", "decision", "reason", "verified", "suspended", "from", "to", "key", "value", "sponsor", "plan", "placement"]) {
      if (m[key] !== undefined && m[key] !== null && m[key] !== "") parts.push(`${key}: ${String(m[key])}`);
    }
    return parts.join(" · ");
  }

  function auditTargetLabel(targetType: string | null, targetId: string | null): string {
    if (!targetId) return targetType ?? "—";
    if (targetType === "class") return allClassNameById.get(targetId) ?? targetType;
    if (targetType === "teacher" || targetType === "profile") return profileNameById.get(targetId) ?? targetType;
    return targetType ?? "—";
  }

  const auditLog: AuditLogEntry[] = (auditRows ?? []).map((row) => ({
    id: row.id,
    actorName: row.actor_id ? (profileNameById.get(row.actor_id) ?? "—") : "—",
    action: row.action,
    targetLabel: auditTargetLabel(row.target_type, row.target_id),
    details: auditDetails(row.metadata),
    createdAt: dateFormatter.format(new Date(row.created_at)),
  }));

  // Admin -> Approvals history: the latest approve/reject decisions.
  const approvalDecisions: ApprovalDecision[] = (auditRows ?? [])
    .filter((row) => row.action === "listing_approval_decision")
    .slice(0, 50)
    .map((row) => {
      const meta = (row.metadata as Record<string, unknown> | null) ?? {};
      return {
        id: row.id,
        name: auditTargetLabel(row.target_type, row.target_id),
        decision: meta.decision === "rejected" ? "rejected" : "approved",
        reason: typeof meta.reason === "string" ? meta.reason : "",
        adminName: row.actor_id ? (profileNameById.get(row.actor_id) ?? "—") : "—",
        decidedAt: dateFormatter.format(new Date(row.created_at)),
      };
    });

  // Admin -> Reports: what each reported item is, and where to look at it.
  const reportedAdTitle = new Map((reportedAdRows ?? []).map((r) => [r.id, r.title]));
  const reportedWantedTitle = new Map((reportedWantedRows ?? []).map((r) => [r.id, r.title]));
  const reportedReviewById = new Map((reportedReviewRows ?? []).map((r) => [r.id, r]));
  const reportedInstituteName = new Map((reportedInstituteRows ?? []).map((r) => [r.id, r.name]));
  const openReportsByTarget = new Map<string, number>();
  for (const r of contentReportRows ?? []) {
    if (r.status !== "open") continue;
    const key = `${r.target_type}:${r.target_id}`;
    openReportsByTarget.set(key, (openReportsByTarget.get(key) ?? 0) + 1);
  }
  const contentReports: AdminContentReport[] = (contentReportRows ?? []).map((r) => {
    let targetLabel = t("contentReports.removedItem");
    let targetHref: string | null = null;
    if (r.target_type === "ad") {
      targetLabel = reportedAdTitle.get(r.target_id) ?? targetLabel;
      targetHref = reportedAdTitle.has(r.target_id) ? `/ad/${r.target_id}` : null;
    } else if (r.target_type === "wanted_ad") {
      targetLabel = reportedWantedTitle.get(r.target_id) ?? targetLabel;
      targetHref = reportedWantedTitle.has(r.target_id) ? `/requests/${r.target_id}` : null;
    } else if (r.target_type === "teacher") {
      targetLabel = profileNameById.get(r.target_id) ?? targetLabel;
      targetHref = `/teacher/${r.target_id}`;
    } else if (r.target_type === "institute") {
      targetLabel = reportedInstituteName.get(r.target_id) ?? targetLabel;
      targetHref = `/class/${r.target_id}`;
    } else if (r.target_type === "review") {
      const review = reportedReviewById.get(r.target_id);
      if (review) {
        const reviewed =
          review.target_type === "class"
            ? (allClassNameById.get(review.target_id) ?? "—")
            : (profileNameById.get(review.target_id) ?? "—");
        targetLabel = t("contentReports.reviewOf", { name: reviewed, comment: (review.comment ?? "").slice(0, 80) });
        targetHref = review.target_type === "class" ? `/class/${review.target_id}` : `/teacher/${review.target_id}`;
      }
    }
    return {
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      targetLabel,
      targetHref,
      reason: r.reason,
      details: r.details ?? "",
      reporterName: profileNameById.get(r.reporter_id) ?? "—",
      status: r.status,
      resolutionNote: r.resolution_note ?? "",
      createdAt: dateFormatter.format(new Date(r.created_at)),
      createdAtIso: r.created_at,
      sameTargetCount: openReportsByTarget.get(`${r.target_type}:${r.target_id}`) ?? 0,
    };
  });
  const openReportCount = openReportsByTarget.size;

  const contentOwnerName = (ownerType: string, ownerId: string | null) =>
    ownerId
      ? ((ownerType === "class" ? allClassNameById.get(ownerId) : profileNameById.get(ownerId)) ?? "—")
      : "—";
  const noteTypeLabel: Record<string, string> = {
    tute: t("moderation.detail.tute"),
    short_note: t("moderation.detail.shortNote"),
    past_paper: t("moderation.detail.pastPaper"),
  };
  const moderationItems: ModerationItem[] = [
    ...(moderationNoteRows ?? []).map((r) => ({
      id: r.id,
      kind: "note" as const,
      title: r.title,
      ownerName: contentOwnerName(r.owner_type, r.owner_id),
      detail: noteTypeLabel[r.note_type] ?? "",
      createdAtIso: r.created_at,
      viewHref: null,
    })),
    ...(moderationExamRows ?? []).map((r) => ({
      id: r.id,
      kind: "exam" as const,
      title: r.title,
      ownerName: contentOwnerName(r.owner_type, r.owner_id),
      detail: r.published ? t("moderation.detail.published") : t("moderation.detail.draft"),
      createdAtIso: r.created_at,
      viewHref: null,
    })),
    ...(moderationAssignmentRows ?? []).map((r) => ({
      id: r.id,
      kind: "assignment" as const,
      title: r.title,
      ownerName: contentOwnerName(r.owner_type, r.owner_id),
      detail: r.assignment_type === "homework" ? t("moderation.detail.homework") : t("moderation.detail.assignment"),
      createdAtIso: r.created_at,
      viewHref: null,
    })),
    ...(moderationAdRows ?? []).map((r) => ({
      id: r.id,
      kind: "ad" as const,
      title: r.title,
      ownerName: contentOwnerName(r.owner_type, r.owner_id),
      detail: r.status === "active" ? t("moderation.detail.live") : t("moderation.detail.paused"),
      createdAtIso: r.created_at,
      viewHref: r.status === "active" ? `/ad/${r.id}` : null,
    })),
    ...(moderationWantedRows ?? []).map((r) => ({
      id: r.id,
      kind: "wantedAd" as const,
      title: r.title,
      ownerName: profileNameById.get(r.student_id) ?? "—",
      detail: r.status === "active" ? t("moderation.detail.open") : t("moderation.detail.closed"),
      createdAtIso: r.created_at,
      viewHref: r.status === "active" ? `/requests/${r.id}` : null,
    })),
  ]
    .sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime())
    .map((item) => ({ ...item, createdAt: dateFormatter.format(new Date(item.createdAtIso)) }));

  const settingValue = (key: string, fallback: string) =>
    settingsRows?.find((s) => s.key === key)?.value ?? fallback;
  const featureStates: PlatformFeatureState[] = PLATFORM_FEATURES.map((key) => ({
    key,
    enabled: settingValue(featureSettingKey(key), "true") !== "false",
  }));
  const announcementTone = settingValue("announcement_tone", "info");
  const announcementSettings = {
    enabled: settingValue("announcement_enabled", "false") === "true",
    text: settingValue("announcement_text", ""),
    tone: (announcementTone === "warning" || announcementTone === "success" ? announcementTone : "info") as
      | "info"
      | "warning"
      | "success",
  };
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

  const expiringSiteAds = siteAds.filter((ad) => ad.status === "expiring");
  const nextExpiringAd = expiringSiteAds[0]
    ? { sponsor: expiringSiteAds[0].sponsor, expiresDisplay: expiringSiteAds[0].expiresDisplay }
    : null;

  const navAvailability = await getNavAvailability();

  const mrr = standardMrr + premiumMrr;
  const failedPaymentCount = payments.filter((p) => p.status === "failed").length;
  const verificationWaiting = platformUsers.filter((u) => u.hasVerificationDocument && !u.institutionVerified).length;

  return (
    <DashboardShell
      brandBadge="ADMIN"
      userLabel={profile.full_name}
      userInitial={userInitial}
      navAvailability={navAvailability}
      announcement={announcement}
      logoutLabel={t("logout")}
      demoRole="admin"
      notifications={notifications}
      realtimeWatch={[{ table: "notifications", filter: `recipient_id=eq.${user!.id}` }]}
      groups={[
        {
          key: "insights",
          label: t("groupInsights"),
          items: [
            { key: "overview", label: t("tabs.overview") },
            { key: "growth", label: t("tabs.growth") },
            { key: "earnings", label: t("tabs.earnings") },
            { key: "activity", label: t("tabs.activity") },
            { key: "traffic", label: t("tabs.traffic") },
          ],
        },
        {
          key: "platform",
          label: t("groupPlatform"),
          items: [
            { key: "approvals", label: t("tabs.approvals"), count: approvals.length },
            { key: "users", label: t("tabs.users"), count: verificationWaiting || undefined },
            { key: "platformSwitches", label: t("tabs.platformSwitches") },
          ],
        },
        {
          key: "monetization",
          label: t("groupMonetization"),
          items: [
            { key: "payments", label: t("tabs.payments"), count: failedPaymentCount || undefined },
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
          key: "trust",
          label: t("groupTrust"),
          items: [
            { key: "reports", label: t("tabs.reports"), count: openReportCount || undefined },
            { key: "flagged", label: t("tabs.flagged"), count: flaggedReviews.length },
            { key: "moderation", label: t("tabs.moderation") },
            { key: "connections", label: t("tabs.connections") },
            { key: "auditLog", label: t("tabs.auditLog") },
          ],
        },
      ]}
      panels={{
        overview: (
          <OverviewTab
            adminName={profile.full_name}
            reports={reports}
            traffic={trafficYear}
            mrr={mrr}
            attention={{
              pendingApprovals: approvals.length,
              openReports: openReportCount,
              flaggedReviews: flaggedReviews.length,
              failedPayments: failedPaymentCount,
              verificationWaiting,
              expiringAds: expiringSiteAds.length,
              nextExpiringAd,
            }}
          />
        ),
        growth: <GrowthTab reports={reports} users={platformUsers} />,
        earnings: (
          <EarningsTab
            reports={reports}
            payments={payments}
            mrr={mrr}
            subscriberCount={activeStandardCount + activePremiumCount}
          />
        ),
        activity: <ActivityTab reports={reports} />,
        traffic: <TrafficTab initialReport={trafficMonth} initialRange="30d" />,
        approvals: (
          <ApprovalsTab
            initialApprovals={approvals}
            decisions={approvalDecisions}
            avgDecisionDays={reports.approvalStats.avgDecisionDays}
          />
        ),
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
        payments: <PaymentsTab payments={payments} />,
        auditLog: <AuditLogTab entries={auditLog} />,
        moderation: <ModerationTab initialItems={moderationItems} />,
        reports: <ReportsTab initialReports={contentReports} />,
        platformSwitches: <PlatformSwitchesTab initialFeatures={featureStates} initialAnnouncement={announcementSettings} />,
      }}
      defaultTab="overview"
    />
  );
}
