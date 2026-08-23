import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Public counterpart to (dashboard)/student/notes/[id]/file — same signed-URL
// hand-off, but reachable from anywhere a note might be linked from (e.g. the
// free-preview section on a teacher's ad, /ad/[id]/page.tsx), not just the
// student dashboard. Access is entirely governed by notes' own RLS (0008,
// 0045): owner, enrolled student, admin, or a public note viewed by any
// signed-in account — a 404 here can mean "doesn't exist" or "not allowed",
// which is correct, this endpoint shouldn't distinguish the two.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: note } = await supabase.from("notes").select("file_path").eq("id", id).maybeSingle();
  if (!note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: signed, error } = await supabase.storage.from("notes").createSignedUrl(note.file_path, 60);
  if (error || !signed) {
    return NextResponse.json({ error: "Couldn't open this file" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl);
}
