"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type ActionResult = { error: string } | { error?: undefined };

async function resolveInstituteId(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data } = await supabase.from("class_profiles").select("id").eq("owner_id", userId).maybeSingle();
  return data?.id ?? null;
}

const uploadSchema = z.object({
  title: z.string().trim().min(2),
  description: z.string().trim().optional(),
  category: z.string().trim().optional(),
});

export async function uploadLibraryResource(formData: FormData): Promise<ActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please choose a PDF file." };
  }
  if (file.type !== "application/pdf") {
    return { error: "Only PDF files are supported." };
  }

  const parsed = uploadSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || undefined,
  });
  if (!parsed.success) {
    return { error: "Please enter a title." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const instituteId = await resolveInstituteId(supabase, user.id);
  if (!instituteId) return { error: "Save your institute details first." };

  const resourceId = crypto.randomUUID();
  const filePath = `${instituteId}/${resourceId}.pdf`;

  const { error: uploadError } = await supabase.storage.from("library").upload(filePath, file, {
    contentType: "application/pdf",
    upsert: false,
  });
  if (uploadError) return { error: "Couldn't upload the file. Please try again." };

  const { error: insertError } = await supabase.from("library_resources").insert({
    id: resourceId,
    owner_type: "class",
    owner_id: instituteId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    category: parsed.data.category || null,
    file_path: filePath,
  });
  if (insertError) {
    await supabase.storage.from("library").remove([filePath]);
    return { error: "Couldn't save the resource. Please try again." };
  }
  return {};
}

export async function deleteLibraryResource(resourceId: string, filePath: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("library_resources").delete().eq("id", resourceId);
  if (error) return { error: "Couldn't delete this resource. Please try again." };
  await supabase.storage.from("library").remove([filePath]);
  return {};
}

export async function incrementLibraryResourceView(resourceId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("increment_library_resource_view", { p_resource_id: resourceId });
}
