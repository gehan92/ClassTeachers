"use server";

import { createClient } from "@/lib/supabase/server";

type ActionResult = { error?: string };

const extensionByType: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Campus credentials panel -> "Upload verification document" (0076). Fixed
 * filename per user, same as uploadAvatar (avatar-actions.ts) — a
 * re-submission overwrites in place via `upsert` rather than accumulating
 * files. Always resets institution_verified back to false: the previous
 * approval was for whatever evidence used to be at this path, and it's no
 * longer there, so an admin has to look at the new one before it counts
 * again.
 */
export async function uploadVerificationDocument(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a file." };
  }
  const extension = extensionByType[file.type];
  if (!extension) {
    return { error: "Please upload a PDF, JPG, PNG, or WEBP file." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { data: existing } = await supabase
    .from("teacher_profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();
  if (!existing) {
    return { error: "Save your profile details first." };
  }

  const path = `${user.id}/document.${extension}`;
  const { error: uploadError } = await supabase.storage.from("verification-docs").upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return { error: "Couldn't upload the document. Please try again." };
  }

  const { error } = await supabase
    .from("teacher_profiles")
    .update({
      verification_document_path: path,
      verification_submitted_at: new Date().toISOString(),
      institution_verified: false,
    })
    .eq("id", user.id);
  if (error) {
    return { error: "Couldn't save this. Please try again." };
  }
  return {};
}
