"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { resolveBatchOwner } from "@/lib/dashboard/resolve-batch-owner";
import { notifyContentAudience } from "@/lib/dashboard/notify";

type ActionResult = { error: string } | { error?: undefined };

// Keeps the free-preview section on a teacher's ad a teaser, not a
// substitute for actually joining their class.
const MAX_PUBLIC_NOTES = 3;

const uploadNoteSchema = z.object({
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

  // Institute Blueprint step 3b — a batch resolves to either the teacher's
  // own account or, if it's one they're assigned to, the institute that
  // owns it (0091/0093). No batchId at all keeps today's default: a plain
  // teacher-owned, unscoped note.
  const target = await resolveBatchOwner(supabase, user.id, parsed.data.batchId);
  if ("error" in target) {
    return target;
  }

  const noteId = crypto.randomUUID();
  const filePath = `${target.ownerId}/${noteId}.pdf`;

  const { error: uploadError } = await supabase.storage.from("notes").upload(filePath, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) {
    return { error: "Couldn't upload the file. Please try again." };
  }

  const { error: insertError } = await supabase.from("notes").insert({
    id: noteId,
    owner_type: target.ownerType,
    owner_id: target.ownerId,
    batch_id: target.batchId,
    title: parsed.data.title,
    file_path: filePath,
  });
  if (insertError) {
    await supabase.storage.from("notes").remove([filePath]);
    return { error: "Couldn't save the note. Please try again." };
  }

  await notifyContentAudience(supabase, target, null, "new_note", { title: parsed.data.title }, "notes", "newClassContent");

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

  const { data: note } = await supabase.from("notes").select("owner_type, owner_id").eq("id", noteId).maybeSingle();
  if (!note) {
    return { error: "Note not found." };
  }

  let batchId: string | null = null;
  if (parsed.data.batchId) {
    const target = await resolveBatchOwner(supabase, user.id, parsed.data.batchId);
    if ("error" in target) {
      return target;
    }
    if (target.ownerType !== note.owner_type || target.ownerId !== note.owner_id) {
      return { error: "That class doesn't belong to this note's owner." };
    }
    batchId = target.batchId;
  }

  // No owner_type/owner_id filter here — can_manage_content (0093) is the
  // real gate, including for a linked teacher editing an institute note.
  const { error } = await supabase
    .from("notes")
    .update({ title: parsed.data.title, batch_id: batchId })
    .eq("id", noteId);
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

  const { data: note } = await supabase.from("notes").select("owner_type, owner_id").eq("id", noteId).maybeSingle();
  if (!note) {
    return { error: "Note not found." };
  }

  if (isPublic) {
    // Capped per owner (the institute's total, not this one linked
    // teacher's own count) — a free-preview slot is a fact about the
    // institute's public page, not about who happened to upload the note.
    const { count } = await supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", note.owner_type)
      .eq("owner_id", note.owner_id)
      .eq("is_public", true);
    if ((count ?? 0) >= MAX_PUBLIC_NOTES) {
      return { error: `You can only feature up to ${MAX_PUBLIC_NOTES} notes as free previews.` };
    }
  }

  const { error } = await supabase.from("notes").update({ is_public: isPublic }).eq("id", noteId);
  if (error) {
    return { error: "Couldn't update this note. Please try again." };
  }

  return {};
}
