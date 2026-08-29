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
 * "Get verified" panel -> "Upload verification document" (0076, extended to
 * every teacher/institute — not just campus lecturers — by 0087). Fixed
 * filename per user, same as uploadAvatar (avatar-actions.ts) — a
 * re-submission overwrites in place via `upsert` rather than accumulating
 * files. Always resets institution_verified back to false: the previous
 * approval was for whatever evidence used to be at this path, and it's no
 * longer there, so an admin has to look at the new one before it counts
 * again (0087 carves this one self-reset out of the "only an admin can
 * change this" trigger on both tables).
 */
export async function uploadVerificationDocument(
  ownerType: "teacher" | "class",
  formData: FormData,
): Promise<ActionResult> {
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

  const table = ownerType === "teacher" ? "teacher_profiles" : "class_profiles";
  // .eq()'s column argument won't narrow correctly against a table picked at
  // runtime, so the owner-column lookup (id vs owner_id) needs its own
  // literal-typed branch rather than a shared variable.
  const { data: existing } =
    ownerType === "teacher"
      ? await supabase.from("teacher_profiles").select("id").eq("id", user.id).maybeSingle()
      : await supabase.from("class_profiles").select("id").eq("owner_id", user.id).maybeSingle();
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
    .from(table)
    .update({
      verification_document_path: path,
      verification_submitted_at: new Date().toISOString(),
      institution_verified: false,
    })
    .eq("id", existing.id);
  if (error) {
    return { error: "Couldn't save this. Please try again." };
  }
  return {};
}
