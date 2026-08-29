import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where every Supabase auth email link (currently just password recovery —
 * see requestPasswordResetAction) actually lands first. The link itself
 * only carries a one-time `code`; this exchanges it for a real session
 * (written to cookies by the SSR client) before handing the browser off to
 * `next`, which is the only step reset-password's form can't do itself —
 * by the time a page component renders, the code needs to already be spent.
 *
 * Lives under /api rather than /auth so proxy.ts's matcher (which excludes
 * "api") skips both next-intl's locale rewriting and the protected/
 * guest-only redirects for this one request — neither applies to a raw
 * code-exchange hop.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Expired/already-used/malformed link — reset-password's own page checks
  // for a session and shows an "invalid link" state, but sending the
  // browser straight to forgot-password (same locale prefix `next` already
  // carries) skips that extra hop.
  const fallback = next.replace(/\/reset-password$/, "/forgot-password");
  return NextResponse.redirect(`${origin}${fallback}`);
}
