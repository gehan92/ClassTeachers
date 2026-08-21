import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { locales, routing } from "@/i18n/routing";
import { refreshSession } from "@/lib/supabase/proxy";
import { protectedPathPrefixes } from "@/lib/auth/routes";

// Next.js 16 renamed "Middleware" to "Proxy" (same runtime, new file
// convention: proxy.ts at the project root instead of middleware.ts).
const handleI18nRouting = createMiddleware(routing);

const localePrefixPattern = new RegExp(`^/(${locales.join("|")})(?=/|$)`);

export async function proxy(request: NextRequest) {
  // Refresh the auth cookie first — every branch below needs to know who's
  // signed in, and whichever response we end up returning needs to carry
  // any rotated tokens back to the browser.
  const { response: authResponse, user } = await refreshSession(request);

  const pathname = request.nextUrl.pathname;
  const localeMatch = pathname.match(localePrefixPattern);
  const locale = localeMatch ? localeMatch[1] : routing.defaultLocale;
  const path = localeMatch ? pathname.slice(localeMatch[0].length) || "/" : pathname;

  // "/teacher" (the dashboard, no sub-routes of its own) collides with
  // "/teacher/[id]" (the PUBLIC profile page — src/app/[locale]/(public)/
  // teacher/[id]) since both start with the same segment. Every other
  // protected prefix either has no public counterpart (institute's public
  // page lives at /class/[id] instead) or genuinely needs its sub-routes
  // gated (student/notes/[id]/file), so only "/teacher" needs the narrower,
  // exact-only match.
  const isProtected = protectedPathPrefixes.some((prefix) =>
    prefix === "/teacher" ? path === prefix : path === prefix || path.startsWith(`${prefix}/`),
  );
  const isGuestOnly = path === "/login" || path === "/signup";

  if (isProtected && !user) {
    const redirectResponse = NextResponse.redirect(new URL(`/${locale}/login`, request.url));
    authResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (isGuestOnly && user) {
    const redirectResponse = NextResponse.redirect(new URL(`/${locale}`, request.url));
    authResponse.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  const intlResponse = handleI18nRouting(request);
  authResponse.cookies.getAll().forEach((cookie) => intlResponse.cookies.set(cookie));
  return intlResponse;
}

export const config = {
  matcher: ["/((?!api|trpc|_next|_vercel|.*\\..*).*)"],
};
