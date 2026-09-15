import { cache } from "react";
import { createClient } from "./server";

/**
 * Same result as calling supabase.auth.getUser() directly, except memoized
 * for the lifetime of one request via React's cache(). src/proxy.ts (via
 * lib/supabase/proxy.ts) already re-validates the session against Supabase's
 * servers once per navigation — this only stops separate Server Components
 * rendered within that SAME request (e.g. (public)/layout.tsx and the page
 * it wraps) from each independently repeating that same network round trip.
 * Every caller still gets a fully server-verified user; this just avoids
 * asking twice for it.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
