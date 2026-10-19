import type { MetadataRoute } from "next";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { routing } from "@/i18n/routing";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { getSiteUrl } from "@/lib/site-url";

// Rebuilt at most once an hour, so search engines see new ads within the day.
export const revalidate = 3600;

const STATIC_PATHS: { path: string; priority: number; changeFrequency: "daily" | "weekly" | "monthly" }[] = [
  { path: "", priority: 1, changeFrequency: "daily" },
  { path: "/teachers", priority: 0.9, changeFrequency: "daily" },
  { path: "/requests", priority: 0.7, changeFrequency: "daily" },
  { path: "/advertise", priority: 0.6, changeFrequency: "weekly" },
  { path: "/roles", priority: 0.5, changeFrequency: "monthly" },
  { path: "/help", priority: 0.5, changeFrequency: "monthly" },
  { path: "/signup", priority: 0.4, changeFrequency: "monthly" },
  { path: "/terms", priority: 0.2, changeFrequency: "monthly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "monthly" },
];

/** One entry per page, listing the page in every language. */
function entry(
  base: string,
  path: string,
  options: { priority: number; changeFrequency: "daily" | "weekly" | "monthly"; lastModified?: Date },
): MetadataRoute.Sitemap[number] {
  const languages = Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`]));
  return { url: `${base}/${routing.defaultLocale}${path}`, alternates: { languages }, ...options };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getSiteUrl();
  const entries = STATIC_PATHS.map(({ path, ...options }) => entry(base, path, options));

  // Live ads and open requests — the same public lists a signed-out visitor sees.
  try {
    const supabase = createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
    const [{ data: teacherAds }, { data: classAds }, { data: requests }] = await Promise.all([
      supabase.rpc("list_teacher_ads"),
      supabase.rpc("list_class_batch_ads"),
      supabase.rpc("list_public_wanted_ads"),
    ]);
    const adIds = new Set([...(teacherAds ?? []).map((r) => r.ad_id), ...(classAds ?? []).map((r) => r.ad_id)]);
    for (const id of adIds) entries.push(entry(base, `/ad/${id}`, { priority: 0.8, changeFrequency: "weekly" }));
    for (const r of requests ?? []) {
      entries.push(entry(base, `/requests/${r.id}`, { priority: 0.5, changeFrequency: "weekly" }));
    }
  } catch {
    // The static pages are still worth listing if the database is unreachable.
  }
  return entries;
}
