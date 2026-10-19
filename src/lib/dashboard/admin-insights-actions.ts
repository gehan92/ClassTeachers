"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/dashboard/notify";
import { moderateContent } from "@/lib/dashboard/admin-actions";
import { createDateFormatter } from "@/lib/format-date";
import { ANNOUNCEMENT_CACHE_TAG, ANNOUNCEMENT_MAX_LENGTH } from "@/lib/site-announcement";
import type { Json } from "@/types/database";
import type {
  AdminUserDetail,
  PlatformUserRole,
  TrafficReport,
  TrafficReportResult,
} from "@/types/dashboard-admin";

/**
 * Server actions behind the admin reporting screens (Traffic, user detail,
 * Reports queue, Settings -> Announcement). Every action re-checks that the
 * caller is an admin before touching anything, because the service-role
 * client used for some reads bypasses RLS entirely.
 */

type ActionResult = { error: string } | { error?: undefined };

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { error: "You don't have permission to do that." };
  return { userId: user.id };
}

async function logAdminAction(
  actorId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  metadata: Record<string, Json> = {},
) {
  const supabase = await createClient();
  await supabase.from("audit_log").insert({ actor_id: actorId, action, target_type: targetType, target_id: targetId, metadata });
}

// ------------------------------------------------------------- traffic

function emptyTraffic(): TrafficReport {
  return {
    firstVisitAt: null,
    totals: { visits: 0, visitors: 0, signedInUsers: 0, publicVisits: 0 },
    daily: [],
    pages: [],
    ads: [],
    referrers: [],
    devices: [],
    locales: [],
    roles: [],
    features: [],
    searches: [],
  };
}

/**
 * Admin -> Traffic for the last `days` days. Aggregated inside the database
 * by admin_traffic_report (0165). Returns { report: null } when that
 * migration hasn't been run yet, so the screen can explain instead of
 * erroring.
 */
export async function loadTrafficReport(days: number): Promise<TrafficReportResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { report: null, error: admin.error };
  const supabase = await createClient();
  const safeDays = Math.max(1, Math.min(400, Math.round(days) || 30));
  const { data, error } = await supabase.rpc("admin_traffic_report", { p_days: safeDays });
  if (error || !data) return { report: null };

  const raw = data as unknown as Omit<TrafficReport, "ads"> & { ads: { id: string; n: number; visitors: number }[] };
  const report: TrafficReport = { ...emptyTraffic(), ...raw, ads: [] };
  const adIds = (raw.ads ?? []).map((a) => a.id).filter(Boolean);
  if (adIds.length) {
    const { data: ads } = await supabase.from("advertisements").select("id, title").in("id", adIds);
    const titleById = new Map((ads ?? []).map((a) => [a.id, a.title]));
    report.ads = raw.ads.map((a) => ({ ...a, title: titleById.get(a.id) ?? "—" }));
  }
  // Keep the tracking tables small; harmless when nothing is old enough.
  void supabase.rpc("prune_analytics").then(
    () => undefined,
    () => undefined,
  );
  return { report };
}

// -------------------------------------------------------- announcement

export async function updateAnnouncement(input: {
  enabled: boolean;
  text: string;
  tone: "info" | "warning" | "success";
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  const text = input.text.replace(/\s+/g, " ").trim().slice(0, ANNOUNCEMENT_MAX_LENGTH);
  if (input.enabled && text.length < 5) {
    return { error: "Write the message you want everyone to see (at least a few words)." };
  }
  const tone = input.tone === "warning" || input.tone === "success" ? input.tone : "info";
  const supabase = await createClient();
  const { error } = await supabase.from("platform_settings").upsert(
    [
      { key: "announcement_enabled", value: input.enabled ? "true" : "false" },
      { key: "announcement_text", value: text },
      { key: "announcement_tone", value: tone },
    ],
    { onConflict: "key" },
  );
  if (error) return { error: "Couldn't save the announcement. Please try again." };
  await logAdminAction(admin.userId, "announcement_updated", "platform_setting", null, {
    value: input.enabled ? text : "off",
  });
  revalidateTag(ANNOUNCEMENT_CACHE_TAG, "max");
  return {};
}

// ---------------------------------------------------------- user detail

const PLATFORM_ROLE: Record<string, PlatformUserRole | "admin"> = {
  student: "student",
  teacher: "teacher",
  campus_lecturer: "campus_lecturer",
  class: "institute",
  admin: "admin",
};

/** Everything about one account, for the user detail panel in Admin -> Users. */
export async function getAdminUserDetail(
  userId: string,
  locale: string,
): Promise<{ detail?: AdminUserDetail; error?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { error: "Unknown user." };

  const db = createAdminClient();
  const fmt = createDateFormatter(locale);
  const money = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
  const date = (iso: string | null | undefined) => (iso ? fmt.format(new Date(iso)) : "—");

  const [{ data: profile }, { data: authData }] = await Promise.all([
    db.from("profiles").select("id, full_name, role, phone, location, created_at, profile_completed_at").eq("id", userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  if (!profile) return { error: "This account no longer exists." };

  const role = PLATFORM_ROLE[profile.role] ?? "student";
  const authUser = authData?.user ?? null;
  const suspended = Boolean(authUser?.banned_until && new Date(authUser.banned_until).getTime() > Date.now());

  // The ids this person "owns": their own id, plus the institute's class_profiles id.
  let ownerType: "teacher" | "class" | null = null;
  let ownerId: string | null = null;
  let listingStatus: string | null = null;
  let published: boolean | null = null;
  let verified: boolean | null = null;
  if (role === "teacher" || role === "campus_lecturer") {
    const { data: tp } = await db
      .from("teacher_profiles")
      .select("id, status, owner_published, institution_verified")
      .eq("id", userId)
      .maybeSingle();
    ownerType = "teacher";
    ownerId = userId;
    listingStatus = tp?.status ?? null;
    published = tp?.owner_published ?? null;
    verified = tp?.institution_verified ?? null;
  } else if (role === "institute") {
    const { data: cp } = await db
      .from("class_profiles")
      .select("id, status, owner_published, institution_verified")
      .eq("owner_id", userId)
      .maybeSingle();
    ownerType = "class";
    ownerId = cp?.id ?? null;
    listingStatus = cp?.status ?? null;
    published = cp?.owner_published ?? null;
    verified = cp?.institution_verified ?? null;
  }
  const targetIds = [userId, ...(ownerId && ownerId !== userId ? [ownerId] : [])];

  const [auditRes, reportsRes] = await Promise.all([
    db
      .from("audit_log")
      .select("actor_id, action, metadata, created_at")
      .in("target_id", targetIds)
      .order("created_at", { ascending: false })
      .limit(20),
    db.from("content_reports").select("id", { count: "exact", head: true }).in("target_id", targetIds),
  ]);

  const stats: AdminUserDetail["stats"] = [];
  const classes: AdminUserDetail["classes"] = [];
  let payments: AdminUserDetail["payments"] = [];

  if (role === "student") {
    const [{ data: enrollments }, { data: paymentRows }, { count: reviewsWritten }, { count: examsTaken }] = await Promise.all([
      db
        .from("enrollments")
        .select("owner_type, owner_id, batch_id, status, joined_at")
        .eq("student_id", userId)
        .order("joined_at", { ascending: false })
        .limit(20),
      db
        .from("platform_payments")
        .select("purpose, amount, status, created_at")
        .eq("student_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      db.from("reviews").select("id", { count: "exact", head: true }).eq("reviewer_id", userId),
      db.from("exam_submissions").select("id", { count: "exact", head: true }).eq("student_id", userId),
    ]);
    const batchIds = [...new Set((enrollments ?? []).map((e) => e.batch_id).filter((id): id is string => Boolean(id)))];
    const teacherIds = [...new Set((enrollments ?? []).filter((e) => e.owner_type !== "class").map((e) => e.owner_id))];
    const classIds = [...new Set((enrollments ?? []).filter((e) => e.owner_type === "class").map((e) => e.owner_id))];
    const [{ data: batchRows }, { data: teacherRows }, { data: classRows }] = await Promise.all([
      batchIds.length ? db.from("batches").select("id, title").in("id", batchIds) : Promise.resolve({ data: [] as { id: string; title: string }[] }),
      teacherIds.length ? db.from("profiles").select("id, full_name").in("id", teacherIds) : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
      classIds.length ? db.from("class_profiles").select("id, name").in("id", classIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);
    const batchTitle = new Map((batchRows ?? []).map((b) => [b.id, b.title]));
    const ownerName = new Map<string, string>([
      ...(teacherRows ?? []).map((r) => [r.id, r.full_name] as [string, string]),
      ...(classRows ?? []).map((r) => [r.id, r.name] as [string, string]),
    ]);
    for (const e of enrollments ?? []) {
      classes.push({
        title: (e.batch_id ? batchTitle.get(e.batch_id) : null) ?? ownerName.get(e.owner_id) ?? "—",
        detail: `${ownerName.get(e.owner_id) ?? "—"} · ${date(e.joined_at)}`,
        status: e.status,
      });
    }
    payments = (paymentRows ?? []).map((p) => ({ purpose: p.purpose, amount: Number(p.amount), status: p.status, date: date(p.created_at) }));
    const spent = payments.filter((p) => p.status === "completed").reduce((sum, p) => sum + p.amount, 0);
    stats.push(
      { label: "enrollments", value: String((enrollments ?? []).length) },
      { label: "exams", value: String(examsTaken ?? 0) },
      { label: "reviewsWritten", value: String(reviewsWritten ?? 0) },
      { label: "spent", value: `Rs. ${money.format(spent)}` },
    );
  } else if (ownerType && ownerId) {
    const [{ data: batchRows }, { count: studentCount }, { count: examCount }, { count: noteCount }, { data: reviewRows }] = await Promise.all([
      db
        .from("batches")
        .select("title, status, created_at")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("created_at", { ascending: false })
        .limit(20),
      db
        .from("enrollments")
        .select("id", { count: "exact", head: true })
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .in("status", ["joined", "accepted"]),
      db.from("exams").select("id", { count: "exact", head: true }).eq("owner_type", ownerType).eq("owner_id", ownerId),
      db.from("notes").select("id", { count: "exact", head: true }).eq("owner_type", ownerType).eq("owner_id", ownerId),
      db.from("reviews").select("rating").eq("target_id", ownerId),
    ]);
    for (const b of batchRows ?? []) classes.push({ title: b.title, detail: date(b.created_at), status: null });
    const ratings = (reviewRows ?? []).map((r) => r.rating);
    const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
    stats.push(
      { label: "classes", value: String((batchRows ?? []).length) },
      { label: "students", value: String(studentCount ?? 0) },
      { label: "exams", value: String(examCount ?? 0) },
      { label: "notes", value: String(noteCount ?? 0) },
      { label: "reviewsReceived", value: avg ? `${ratings.length} · ${avg}★` : "0" },
    );
  }

  const actorIds = [...new Set((auditRes.data ?? []).map((r) => r.actor_id).filter((id): id is string => Boolean(id)))];
  const { data: actors } = actorIds.length
    ? await db.from("profiles").select("id, full_name").in("id", actorIds)
    : { data: [] as { id: string; full_name: string }[] };
  const actorName = new Map((actors ?? []).map((a) => [a.id, a.full_name]));
  const reportsAgainst = reportsRes.count ?? 0;
  if (reportsAgainst > 0) stats.push({ label: "reports", value: String(reportsAgainst) });

  return {
    detail: {
      id: profile.id,
      name: profile.full_name,
      email: authUser?.email ?? null,
      phone: profile.phone,
      role,
      location: profile.location,
      joinedAt: date(profile.created_at),
      lastSignInAt: authUser?.last_sign_in_at ? date(authUser.last_sign_in_at) : null,
      onboarded: Boolean(profile.profile_completed_at),
      suspended,
      listingStatus,
      published,
      verified,
      stats,
      classes,
      payments,
      adminActions: (auditRes.data ?? []).map((r) => {
        const meta = (r.metadata as Record<string, unknown> | null) ?? {};
        const details = ["decision", "reason", "from", "to", "suspended", "verified", "title"]
          .filter((k) => meta[k] !== undefined && meta[k] !== null && meta[k] !== "")
          .map((k) => `${k}: ${String(meta[k])}`)
          .join(" · ");
        return { action: r.action, details, adminName: (r.actor_id && actorName.get(r.actor_id)) || "—", date: date(r.created_at) };
      }),
      reportsAgainst,
    },
  };
}

// ------------------------------------------------------- content reports

/**
 * Close a user report from Admin -> Reports. "resolved" means action was
 * taken (optionally removing the reported ad / request / review right
 * here); "dismissed" means nothing was wrong. The person who reported it is
 * told the outcome either way.
 */
export async function resolveContentReport(input: {
  id: string;
  decision: "resolved" | "dismissed";
  note: string;
  removeContent?: boolean;
}): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };
  const note = input.note.trim().slice(0, 500);
  if (input.removeContent && note.length < 5) {
    return { error: "Add a short reason — it's sent to the owner of the removed item." };
  }

  const supabase = await createClient();
  const { data: report } = await supabase
    .from("content_reports")
    .select("id, reporter_id, target_type, target_id, status")
    .eq("id", input.id)
    .maybeSingle();
  if (!report) return { error: "This report no longer exists." };
  if (report.status !== "open") return { error: "This report was already handled." };

  // Read the title first — removing the item below deletes it.
  let title = "";
  if (report.target_type === "ad") {
    const { data } = await supabase.from("advertisements").select("title").eq("id", report.target_id).maybeSingle();
    title = data?.title ?? "";
  } else if (report.target_type === "wanted_ad") {
    const { data } = await supabase.from("wanted_ads").select("title").eq("id", report.target_id).maybeSingle();
    title = data?.title ?? "";
  } else if (report.target_type === "teacher") {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", report.target_id).maybeSingle();
    title = data?.full_name ?? "";
  } else if (report.target_type === "institute") {
    const { data } = await supabase.from("class_profiles").select("name").eq("id", report.target_id).maybeSingle();
    title = data?.name ?? "";
  } else if (report.target_type === "review") {
    const { data } = await supabase.from("reviews").select("comment").eq("id", report.target_id).maybeSingle();
    title = (data?.comment ?? "").slice(0, 60);
  }
  if (input.removeContent && input.decision === "resolved") {
    if (report.target_type === "ad" || report.target_type === "wanted_ad") {
      const result = await moderateContent({
        kind: report.target_type === "ad" ? "ad" : "wantedAd",
        id: report.target_id,
        reason: note,
      });
      if (result.error) return { error: result.error };
    } else if (report.target_type === "review") {
      const { error } = await supabase.from("reviews").delete().eq("id", report.target_id);
      if (error) return { error: "Couldn't remove this review. Please try again." };
      await logAdminAction(admin.userId, "review_removed", "review", report.target_id, { reason: note });
    } else {
      return { error: "Profiles can't be removed from here — suspend the account from Users instead." };
    }
  }

  // Closes every open report on the same item, so duplicates don't linger.
  const { data: closed, error } = await supabase
    .from("content_reports")
    .update({
      status: input.decision,
      resolution_note: note || null,
      resolved_by: admin.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("target_type", report.target_type)
    .eq("target_id", report.target_id)
    .eq("status", "open")
    .select("reporter_id");
  if (error) return { error: "Couldn't update this report. Please try again." };

  await logAdminAction(admin.userId, input.decision === "resolved" ? "report_resolved" : "report_dismissed", report.target_type, report.target_id, {
    decision: input.decision,
    ...(note ? { reason: note } : {}),
  });

  const reporters = [...new Set((closed ?? []).map((r) => r.reporter_id))];
  await Promise.all(
    reporters.map((reporterId) =>
      notify(supabase, reporterId, "report_resolved", { decision: input.decision, title: title || "—" }),
    ),
  );
  return {};
}
