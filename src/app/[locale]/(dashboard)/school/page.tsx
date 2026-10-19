import { getTranslations, setRequestLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import type { NotificationRow } from "@/components/dashboard/notification-bell";
import type { DashboardNavGroup } from "@/types/dashboard";
import { SchoolOverviewTab } from "@/components/school/school-overview-tab";
import { SchoolProfileTab } from "@/components/school/school-profile-tab";
import { SchoolRolesTab } from "@/components/school/school-roles-tab";
import { SchoolApprovalsTab } from "@/components/school/school-approvals-tab";
import { SchoolHistoryTab } from "@/components/school/school-history-tab";
import { SchoolSetupNotice } from "@/components/school/school-setup-notice";
import { createClient } from "@/lib/supabase/server";
import { getSiteAnnouncement } from "@/lib/site-announcement";
import { createDateFormatter, createDateTimeFormatter } from "@/lib/format-date";
import { roleDashboardPath } from "@/lib/auth/routes";
import { isSchoolSignup, registerSchoolFromMetadata } from "@/lib/school/register";
import { formatSchoolHistory } from "@/lib/school/history-format";
import { isCatalogPair, type PermissionGrant, type SchoolAction, type SchoolArea } from "@/lib/school/catalog";
import type { SchoolAccessMap, SchoolApprovalRow, SchoolDetails, SchoolRoleRow } from "@/types/school";

const HISTORY_PAGE = 50;

/** How many of these rows happened in the last `days` days. */
function countSince(rows: { created_at: string }[], days: number): number {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return rows.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
}

/**
 * School Mode dashboard (0166). The Principal (the school's owner account)
 * sees everything; from Phase 1 on, staff members see only the tabs their
 * roles allow — the sidebar is built from school_my_permissions, and every
 * write is checked again inside the database.
 */
export default async function SchoolDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ school?: string }>;
}) {
  const { locale } = await params;
  const { school: requestedSchoolId } = await searchParams;
  setRequestLocale(locale);
  const t = await getTranslations("school");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // proxy.ts already gates /school behind a signed-in session.
  const userId = user!.id;
  const metadata = user!.user_metadata;

  const [{ data: profile }, mySchoolsResult, { data: notificationRows }, announcement] = await Promise.all([
    supabase.from("profiles").select("full_name, role").eq("id", userId).single(),
    supabase.rpc("my_schools"),
    supabase.rpc("list_my_notifications"),
    getSiteAnnouncement(),
  ]);

  const role = profile?.role ?? "student";
  const signedUpAsSchool = role === "class" && isSchoolSignup(metadata);

  if (mySchoolsResult.error) {
    // Migration 0166 hasn't been run yet.
    if (signedUpAsSchool) return <SchoolSetupNotice reason="unavailable" />;
    redirect(`/${locale}${roleDashboardPath[role]}`);
  }

  let schools = mySchoolsResult.data ?? [];
  if (schools.length === 0 && signedUpAsSchool) {
    // Sign-up stores the school details first; creating the school can
    // fail (or happen before the database was ready), so try again here.
    const { schoolId } = await registerSchoolFromMetadata(supabase, metadata);
    if (schoolId) schools = (await supabase.rpc("my_schools")).data ?? [];
  }
  if (schools.length === 0) {
    if (signedUpAsSchool) return <SchoolSetupNotice reason="failed" />;
    redirect(`/${locale}${roleDashboardPath[role]}`);
  }

  const current = schools.find((s) => s.id === requestedSchoolId) ?? schools[0];
  const schoolId = current.id;
  const isOwner = current.is_owner;

  const [
    { data: schoolRow },
    { data: roleRows },
    { data: rolePermissionRows },
    { data: memberRoleRows },
    { data: myPermissionRows },
    { data: approvalRows },
    { data: historyRows },
  ] = await Promise.all([
    supabase.from("schools").select("*").eq("id", schoolId).single(),
    supabase.from("school_roles").select("id, key, name, description, is_system, scope_kind, sort_order").eq("school_id", schoolId),
    supabase.from("school_role_permissions").select("role_id, area, action, needs_approval").eq("school_id", schoolId),
    supabase.from("school_member_roles").select("role_id").eq("school_id", schoolId),
    supabase.rpc("school_my_permissions", { p_school_id: schoolId }),
    supabase.rpc("school_approval_list", { p_school_id: schoolId, p_limit: 200 }),
    supabase.rpc("school_history", { p_school_id: schoolId, p_area: null, p_limit: HISTORY_PAGE + 1, p_offset: 0 }),
  ]);

  if (!schoolRow) {
    return <SchoolSetupNotice reason="failed" />;
  }

  const dateFormatter = createDateFormatter(locale);
  const dateTimeFormatter = createDateTimeFormatter(locale);

  const school: SchoolDetails = {
    id: schoolRow.id,
    name: schoolRow.name,
    slug: schoolRow.slug,
    schoolType: schoolRow.school_type,
    district: schoolRow.district,
    address: schoolRow.address ?? "",
    registrationNumber: schoolRow.registration_number ?? "",
    mediums: schoolRow.mediums,
    gradeFrom: schoolRow.grade_from,
    gradeTo: schoolRow.grade_to,
    contactPhone: schoolRow.contact_phone ?? "",
    contactEmail: schoolRow.contact_email ?? "",
    website: schoolRow.website ?? "",
    status: schoolRow.status,
    decisionReason: schoolRow.decision_reason,
    submittedAt: dateFormatter.format(new Date(schoolRow.submitted_at)),
    decidedAt: schoolRow.decided_at ? dateFormatter.format(new Date(schoolRow.decided_at)) : null,
  };

  // What the viewer may do here, as "area.action" → allow | approval.
  const access: SchoolAccessMap = {};
  for (const p of myPermissionRows ?? []) {
    if (!isCatalogPair(p.area, p.action)) continue;
    access[`${p.area as SchoolArea}.${p.action as SchoolAction}`] = p.needs_approval ? "approval" : "allow";
  }
  const can = (area: SchoolArea, action: SchoolAction) => access[`${area}.${action}`] === "allow";

  const membersByRole = new Map<string, number>();
  for (const m of memberRoleRows ?? []) membersByRole.set(m.role_id, (membersByRole.get(m.role_id) ?? 0) + 1);
  const permissionsByRole = new Map<string, PermissionGrant[]>();
  for (const p of rolePermissionRows ?? []) {
    if (!isCatalogPair(p.area, p.action)) continue;
    const list = permissionsByRole.get(p.role_id) ?? [];
    list.push({ area: p.area as SchoolArea, action: p.action as SchoolAction, needsApproval: p.needs_approval });
    permissionsByRole.set(p.role_id, list);
  }
  const roles: SchoolRoleRow[] = (roleRows ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
    .map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description ?? "",
      isSystem: r.is_system,
      scopeKind: r.scope_kind,
      memberCount: membersByRole.get(r.id) ?? 0,
      permissions: permissionsByRole.get(r.id) ?? [],
    }));

  const approvals: SchoolApprovalRow[] = (approvalRows ?? []).map((a) => ({
    id: a.id,
    area: a.area,
    action: a.action,
    kind: a.kind,
    summary: a.summary,
    status: a.status,
    requesterName: a.requester_name,
    deciderName: a.decider_name,
    decisionNote: a.decision_note,
    createdAt: dateTimeFormatter.format(new Date(a.created_at)),
    decidedAt: a.decided_at ? dateTimeFormatter.format(new Date(a.decided_at)) : null,
    isMine: a.requested_by === userId,
  }));
  const pendingApprovals = approvals.filter((a) => a.status === "pending" && !a.isMine).length;
  // Areas the viewer can approve changes in (the Principal: all of them).
  const approvableAreas = Object.entries(access)
    .filter(([key, value]) => key.endsWith(".approve") && value === "allow")
    .map(([key]) => key.split(".")[0]);

  const historyAll = historyRows ?? [];
  const history = await formatSchoolHistory(historyAll.slice(0, HISTORY_PAGE), locale);
  const changesThisWeek = countSince(historyAll, 7);
  const rolesReviewed = historyAll.some((h) => h.area === "roles");

  const notifications: NotificationRow[] = (notificationRows ?? []).map((n) => ({
    id: n.id,
    type: n.type,
    data: (n.data as Record<string, unknown>) ?? {},
    tab: n.tab,
    readAt: n.read_at,
    createdAt: n.created_at,
  }));

  const showProfile = can("settings", "view");
  const showRoles = can("roles", "view");
  const showApprovals = isOwner || approvableAreas.length > 0 || approvals.some((a) => a.isMine);
  const showHistory = can("history", "view");
  const canEditRoles = isOwner && school.status !== "suspended";

  const groups: DashboardNavGroup[] = [{ items: [{ key: "overview", label: t("tabs.overview") }] }];
  const schoolItems = [
    ...(showProfile ? [{ key: "schoolProfile", label: t("tabs.schoolProfile") }] : []),
    ...(showRoles ? [{ key: "roles", label: t("tabs.roles"), count: roles.length }] : []),
  ];
  if (schoolItems.length) groups.push({ key: "school", label: t("groups.school"), items: schoolItems });
  const oversightItems = [
    ...(showApprovals
      ? [{ key: "approvals", label: t("tabs.approvals"), count: pendingApprovals || undefined, countUrgent: pendingApprovals > 0 }]
      : []),
    ...(showHistory ? [{ key: "changeHistory", label: t("tabs.changeHistory") }] : []),
  ];
  if (oversightItems.length) groups.push({ key: "oversight", label: t("groups.oversight"), items: oversightItems });

  const fullName = profile?.full_name ?? user!.email ?? school.name;

  return (
    <DashboardShell
      announcement={announcement}
      brandBadge={t("brandBadge")}
      userLabel={fullName}
      userInitial={fullName.charAt(0).toUpperCase()}
      userPhotoUrl={schoolRow.logo_url}
      logoutLabel={t("logout")}
      demoRole="class"
      notifications={notifications}
      realtimeWatch={[{ table: "notifications", filter: `recipient_id=eq.${userId}` }]}
      groups={groups}
      defaultTab="overview"
      panels={{
        overview: (
          <SchoolOverviewTab
            school={school}
            isOwner={isOwner}
            viewerName={fullName}
            rolesCount={roles.length}
            customRolesCount={roles.filter((r) => !r.isSystem).length}
            pendingApprovals={pendingApprovals}
            changesThisWeek={changesThisWeek}
            rolesReviewed={rolesReviewed}
            recentHistory={showHistory ? history.slice(0, 5) : []}
            showRoles={showRoles}
            showApprovals={showApprovals}
            showHistory={showHistory}
          />
        ),
        ...(showProfile
          ? { schoolProfile: <SchoolProfileTab school={school} canEdit={can("settings", "edit")} /> }
          : {}),
        ...(showRoles ? { roles: <SchoolRolesTab schoolId={schoolId} roles={roles} canEdit={canEditRoles} /> } : {}),
        ...(showApprovals
          ? {
              approvals: (
                <SchoolApprovalsTab approvals={approvals} approvableAreas={isOwner ? null : approvableAreas} roles={roles} />
              ),
            }
          : {}),
        ...(showHistory
          ? {
              changeHistory: (
                <SchoolHistoryTab
                  schoolId={schoolId}
                  initialRows={history}
                  initialHasMore={historyAll.length > HISTORY_PAGE}
                  canExport={can("history", "export")}
                />
              ),
            }
          : {}),
      }}
    />
  );
}
