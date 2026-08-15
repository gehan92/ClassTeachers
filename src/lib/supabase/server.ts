import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Server-side client for Server Components, Server Actions and Route
 * Handlers — RLS-enforced as the current user (via their session cookie),
 * not an admin bypass. Must be created fresh per request (it closes over
 * that request's cookies), so call this at the top of each server function
 * rather than sharing one instance.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component (not a Server Action/Route
          // Handler) — cookies() is read-only there. Harmless: src/proxy.ts
          // (via src/lib/supabase/proxy.ts) already refreshes the session
          // cookie on every navigation, so this write is redundant there.
        }
      },
    },
  });
}
