"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/dashboard/notify";
import { recordFeatureEvent } from "@/lib/analytics/track-server";

type ActionResult = { error: string } | { error?: undefined };

const reportSchema = z.object({
  targetType: z.enum(["ad", "teacher", "institute", "review", "wanted_ad"]),
  targetId: z.string().uuid(),
  reason: z.enum(["spam", "fake", "inappropriate", "scam", "other"]),
  details: z.string().trim().max(1000).optional(),
});

/** At most this many reports per person per day — stops one account flooding the queue. */
const DAILY_LIMIT = 10;

/**
 * The "Report" button on ads, profiles, reviews and student requests
 * (0165). Signed-in users only; the database allows one open report per
 * person per item. Admins get a bell notification and review it in
 * Admin -> Reports.
 */
export async function submitContentReport(input: {
  targetType: string;
  targetId: string;
  reason: string;
  details?: string;
}): Promise<ActionResult> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) return { error: "Please choose a reason for your report." };
  if (parsed.data.reason === "other" && (parsed.data.details ?? "").length < 5) {
    return { error: "Please tell us briefly what's wrong." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in to report something." };

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("content_reports")
    .select("id", { count: "exact", head: true })
    .eq("reporter_id", user.id)
    .gte("created_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return { error: "You've sent a lot of reports today. Our team is reviewing them — please try again tomorrow." };
  }

  const { error } = await supabase.from("content_reports").insert({
    reporter_id: user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    details: parsed.data.details || null,
  });
  if (error) {
    // 23505 = the one-open-report-per-person unique index.
    if (error.code === "23505") return {};
    return { error: "Couldn't send your report. Please try again." };
  }

  await notifyAdmins(supabase, "content_reported", { kind: parsed.data.targetType, reason: parsed.data.reason }, "reports");
  await recordFeatureEvent("content_reported", { kind: parsed.data.targetType });
  return {};
}
