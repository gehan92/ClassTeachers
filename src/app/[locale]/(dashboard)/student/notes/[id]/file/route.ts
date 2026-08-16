import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await createClient();
  // RLS on `notes` (0008_notes.sql) already restricts this select to the
  // note's owner, an enrolled student, or an admin — a 404 here can mean
  // either "doesn't exist" or "not allowed to see it", which is correct:
  // this endpoint shouldn't distinguish the two to an unauthorized caller.
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
