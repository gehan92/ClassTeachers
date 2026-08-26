"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string; url?: string };

const extensionByType: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function uploadAvatar(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  const ownerType = formData.get("ownerType");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose an image file." };
  }
  const extension = extensionByType[file.type];
  if (!extension) {
    return { error: "Please upload a JPG, PNG, or WEBP image." };
  }
  if (ownerType !== "teacher" && ownerType !== "class" && ownerType !== "student") {
    return { error: "Invalid request." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  // Fixed filename per user (not per-upload) so re-uploads overwrite in
  // place via `upsert` instead of accumulating orphaned files in storage.
  const path = `${user.id}/avatar.${extension}`;
  const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return { error: "Couldn't upload the image. Please try again." };
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);
  // Cache-bust: the path (and therefore the URL) is stable across
  // re-uploads, so without this a browser/CDN cache would keep showing the
  // old image after a new one is uploaded to the same path.
  const url = `${publicUrl}?v=${Date.now()}`;

  if (ownerType === "teacher") {
    const { data: existing } = await supabase.from("teacher_profiles").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
      return { error: "Save your profile details first." };
    }
    const { error } = await supabase.from("teacher_profiles").update({ photo_url: url }).eq("id", user.id);
    if (error) {
      return { error: "Couldn't save your photo. Please try again." };
    }
    return { url };
  }

  if (ownerType === "student") {
    const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
    if (error) {
      return { error: "Couldn't save your photo. Please try again." };
    }
    return { url };
  }

  const { data: classProfile } = await supabase
    .from("class_profiles")
    .select("id")
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!classProfile) {
    return { error: "Save your institute details first." };
  }
  const { error } = await supabase.from("class_profiles").update({ photo_url: url }).eq("id", classProfile.id);
  if (error) {
    return { error: "Couldn't save your logo. Please try again." };
  }
  return { url };
}
