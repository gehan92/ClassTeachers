import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

/**
 * Service-role client that BYPASSES row level security entirely. Only for
 * server actions/route handlers that have already independently verified
 * the caller (e.g. re-checking `role = 'admin'` via the normal request-
 * scoped client from server.ts) — this file existing does not mean it's
 * safe to use; every call site must do its own auth check first. Never
 * import this from a Client Component (the `server-only` import makes
 * that a build error, not just a convention).
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
