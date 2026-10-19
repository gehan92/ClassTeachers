"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseUrl } from "@/lib/supabase/env";
import {
  SITE_CONTENT_CACHE_TAG,
  SITE_CONTENT_SETTING_KEY,
  SITE_MEDIA_BUCKET,
  SITE_MEDIA_FOLDER,
  SITE_PHOTO_SLOTS,
  isValidEmail,
  normalizeSiteContent,
  normalizeWhatsapp,
  type SiteContent,
  type SitePhotoSlot,
} from "@/lib/site-content-schema";

/**
 * Admin -> Site content. Every action re-checks that the caller is an
 * admin: uploads use the service-role client, which bypasses RLS.
 */

type ActionResult = { error: string } | { error?: undefined };

/** The browser shrinks photos before sending (site-content-tab.tsx), so real uploads are well under this. */
const MAX_UPLOAD_BYTES = 950 * 1024;

const EXTENSION_BY_TYPE: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

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

/** Checks the file's first bytes, not just the type the browser claims. */
function looksLikeImage(bytes: Uint8Array, type: string): boolean {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (type === "image/webp") {
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
    return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
  }
  return false;
}

/** The storage path of a photo uploaded through this screen, or null for anything else. */
function uploadedPath(url: string | null): string | null {
  if (!url) return null;
  const marker = `/storage/v1/object/public/${SITE_MEDIA_BUCKET}/`;
  const at = url.indexOf(marker);
  if (at === -1) return null;
  const path = url.slice(at + marker.length).split("?")[0];
  return path.startsWith(`${SITE_MEDIA_FOLDER}/`) ? path : null;
}

export async function uploadSitePhoto(formData: FormData): Promise<{ url?: string; error?: string }> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  const file = formData.get("file");
  const slot = formData.get("slot");
  if (typeof slot !== "string" || !(SITE_PHOTO_SLOTS as readonly string[]).includes(slot)) {
    return { error: "Unknown photo." };
  }
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a photo first." };
  const extension = EXTENSION_BY_TYPE[file.type];
  if (!extension) return { error: "Use a JPG, PNG or WEBP photo." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "This photo is too large. Try a smaller one." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!looksLikeImage(bytes, file.type)) return { error: "This file isn't a real photo." };

  // A new name for every upload, so browsers and the image cache never show the old photo.
  const path = `${SITE_MEDIA_FOLDER}/${slot as SitePhotoSlot}-${Date.now()}.${extension}`;
  const db = createAdminClient();
  const { error } = await db.storage.from(SITE_MEDIA_BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return { error: "Couldn't upload the photo. Please try again." };
  const {
    data: { publicUrl },
  } = db.storage.from(SITE_MEDIA_BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

export async function saveSiteContent(input: SiteContent): Promise<ActionResult> {
  const admin = await requireAdmin();
  if ("error" in admin) return { error: admin.error };

  // Say what's wrong instead of silently dropping a value the admin typed.
  const rawEmail = typeof input?.contact?.email === "string" ? input.contact.email.trim() : "";
  if (rawEmail && !isValidEmail(rawEmail)) return { error: "The email address doesn't look right." };
  const rawWhatsapp = typeof input?.contact?.whatsapp === "string" ? input.contact.whatsapp.trim() : "";
  if (rawWhatsapp && !normalizeWhatsapp(rawWhatsapp)) {
    return { error: "The WhatsApp number doesn't look right. Use a mobile number like 077 123 4567." };
  }
  const rawFacebook = typeof input?.contact?.facebook === "string" ? input.contact.facebook.trim() : "";

  const supabaseUrl = getSupabaseUrl();
  const content = normalizeSiteContent(input, supabaseUrl);
  if (rawFacebook && !content.contact.facebook) return { error: "The Facebook link should start with https://" };

  const supabase = await createClient();
  const { data: previousRow } = await supabase
    .from("platform_settings")
    .select("value")
    .eq("key", SITE_CONTENT_SETTING_KEY)
    .maybeSingle();

  const { error } = await supabase
    .from("platform_settings")
    .upsert({ key: SITE_CONTENT_SETTING_KEY, value: JSON.stringify(content) }, { onConflict: "key" });
  if (error) return { error: "Couldn't save. Please try again." };

  // Remove uploaded photos this save stopped using, so storage doesn't fill up.
  if (previousRow?.value) {
    try {
      const previous = normalizeSiteContent(JSON.parse(previousRow.value), supabaseUrl);
      const stillUsed = new Set(SITE_PHOTO_SLOTS.map((slot) => uploadedPath(content.photos[slot])));
      const unused = SITE_PHOTO_SLOTS.map((slot) => uploadedPath(previous.photos[slot])).filter(
        (path): path is string => path !== null && !stillUsed.has(path),
      );
      if (unused.length) await createAdminClient().storage.from(SITE_MEDIA_BUCKET).remove(unused);
    } catch {
      // A cleanup failure must never undo a successful save.
    }
  }

  await supabase.from("audit_log").insert({
    actor_id: admin.userId,
    action: "site_content_updated",
    target_type: "platform_setting",
    target_id: null,
    metadata: {},
  });
  revalidateTag(SITE_CONTENT_CACHE_TAG, "max");
  return {};
}
