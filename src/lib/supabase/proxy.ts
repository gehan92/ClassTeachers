import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseUrl } from "./env";

/**
 * Reads the auth cookie for this request, rotates it if the access token is
 * near expiry, and reports who's signed in. Must run on every navigation —
 * without it, an expiring session would eventually go stale and Server
 * Components reading it through server.ts's createClient() would see the
 * user logged out even though their refresh token was still good.
 */
export async function refreshSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  // Always re-validated against Supabase's servers rather than just decoded
  // from the cookie — that's what actually catches an expired/revoked token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
