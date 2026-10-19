import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { getSiteUrl } from "@/lib/site-url";

// Search engines may read the public site; dashboards and password screens
// are private (and need a login anyway).
const PRIVATE_PREFIXES = ["/student", "/institute", "/school", "/admin", "/reset-password", "/forgot-password"];

export default function robots(): MetadataRoute.Robots {
  const disallow = ["/api/"];
  for (const l of routing.locales) {
    for (const p of PRIVATE_PREFIXES) disallow.push(`/${l}${p}`);
    // /teacher is the teacher dashboard, but /teacher/<id> is a public profile.
    disallow.push(`/${l}/teacher$`, `/${l}/teacher?`);
  }
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
