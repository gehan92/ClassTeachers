import { unstable_cache } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * The full subject taxonomy (supabase/migrations/0007) is publicly readable
 * reference data ("subjects are publicly readable", using (true)) that only
 * ever changes when an admin edits it. student/page.tsx fetches every row of
 * it (not scoped to any one student — see the comment at its call site) to
 * populate the "post a wanted ad" subject picker, which meant hitting
 * Postgres for the whole table on every single student-dashboard load.
 *
 * Cached for an hour via a plain anon-key client with no cookies (the read
 * needs no user identity, so it isn't tied to any one request the way
 * lib/supabase/server.ts's cookie-bound client is — unstable_cache can't
 * wrap a cookie-dependent call). A newly added subject can take up to an
 * hour to appear here; that's an acceptable trade-off for reference data
 * that changes on the order of months, not something a user is ever waiting
 * on to see reflected instantly.
 *
 * Returns the same `{ data }` shape supabase-js itself returns so every
 * existing `{ data: subjectRows } = await Promise.all([...])` destructure
 * at the call site keeps working unchanged.
 */
export const getCachedSubjects = unstable_cache(
  async () => {
    const supabase = createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseAnonKey());
    const { data } = await supabase.from("subjects").select("id, translations");
    return { data: data ?? [] };
  },
  ["all-subjects"],
  { revalidate: 3600, tags: ["subjects"] },
);
