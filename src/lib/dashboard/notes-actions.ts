"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

// Keeps the free-preview section on a teacher's ad a teaser, not a
// substitute for actually joining their class.
const MAX_PUBLIC_NOTES = 3;

const uploadNoteSchema = z.object({
  ownerType: z.enum(["teacher", "class"]),
  title: z.string().trim().min(2),
  batchId: z.string().uuid().optional(),
});

export async function uploadNote(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a PDF file." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are supported." };
  }

  const parsed = uploadNoteSchema.safeParse({
    ownerType: formData.get("ownerType"),
    title: formData.get("title"),
    batchId: formData.get("batchId") || undefined,
  });
  if (!parsed.success) {
    return { error: "Please check the title and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  let ownerId = user.id;
  if (parsed.data.ownerType === "class") {
    const { data: classProfile } = await supabase
      .from("class_profiles")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();
    if (!classProfile) {
      return { error: "No institute profile found for this account." };
    }
    ownerId = classProfile.id;
  }

  const noteId = crypto.randomUUID();
  const filePath = `${ownerId}/${noteId}.pdf`;

  const { error: uploadError } = await supabase.storage.from("notes").upload(filePath, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    return { error: "Couldn't upload the file. Please try again." };
  }

  const { error: insertError } = await supabase.from("notes").insert({
    id: noteId,
    owner_type: parsed.data.ownerType,
    owner_id: ownerId,
    batch_id: parsed.data.batchId ?? null,
    title: parsed.data.title,
    file_path: filePath,
  });
  if (insertError) {
    await supabase.storage.from("notes").remove([filePath]);
    return { error: "Couldn't save the note. Please try again." };
  }

  return {};
}

const updateNoteSchema = z.object({
  title: z.string().trim().min(2),
  batchId: z.string().uuid().optional(),
});

export async function updateNote(
  noteId: string,
  input: { title: string; batchId?: string },
): Promise<ActionResult> {
  if (!noteId) {
    return { error: "Invalid note." };
  }
  const parsed = updateNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Please check the title and try again." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  const { error } = await supabase
    .from("notes")
    .update({ title: parsed.data.title, batch_id: parsed.data.batchId ?? null })
    .eq("id", noteId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't update this note. Please try again." };
  }

  return {};
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  if (!noteId) {
    return { error: "Invalid note." };
  }

  const supabase = await createClient();
  const { data: note } = await supabase.from("notes").select("file_path").eq("id", noteId).maybeSingle();
  if (!note) {
    return { error: "Note not found." };
  }

  const { error: deleteError } = await supabase.from("notes").delete().eq("id", noteId);
  if (deleteError) {
    return { error: "Couldn't delete the note. Please try again." };
  }

  await supabase.storage.from("notes").remove([note.file_path]);
  return {};
}

export async function toggleNotePublic(noteId: string, isPublic: boolean): Promise<ActionResult> {
  if (!noteId) {
    return { error: "Invalid note." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in." };
  }

  if (isPublic) {
    const { count } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "teacher")
      .eq("owner_id", user.id)
      .eq("is_public", true);
    if ((count ?? 0) >= MAX_PUBLIC_NOTES) {
      return { error: `You can only feature up to ${MAX_PUBLIC_NOTES} notes as free previews.` };
    }
  }

  const { error } = await supabase
    .from("notes")
    .update({ is_public: isPublic })
    .eq("id", noteId)
    .eq("owner_type", "teacher")
    .eq("owner_id", user.id);
  if (error) {
    return { error: "Couldn't update this note. Please try again." };
  }

  return {};
}
