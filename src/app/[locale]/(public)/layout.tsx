import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let headerUser = null;
  if (authUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile) {
      headerUser = { name: profile.full_name, role: profile.role };
    }
  }

  return (
    <>
      {/* Bootstrap adds grid/layout utilities (row/col, d-flex, etc.) for the
          public-page redesign — scoped to this route group only via Next's
          head-hoisting of <link>/<style> rendered inside a nested layout
          (removed automatically when this layout unmounts on client nav).
          Loaded via @import ... layer(bootstrap) rather than a plain <link>
          so it lands in the low-priority "bootstrap" layer registered first
          in globals.css — without this, Bootstrap's unlayered stylesheet
          would beat ANY Tailwind utility regardless of specificity (that's
          what was turning the header's logo/locale-switcher text blue:
          Bootstrap's default link color winning over our `text-primary`
          class). The second <style> block still explicitly strips the
          underline Bootstrap's reboot puts on every <a> — being in the
          bootstrap layer doesn't make Bootstrap's own decoration/color
          declarations disappear, only lose ties against Tailwind, so
          without this a link with no color/decoration utility of its own
          would still show Bootstrap's underline. */}
      <style>{`@import url("https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css") layer(bootstrap);`}</style>
      <style>{`
        body a { text-decoration: none; color: inherit; }
        body h1, body h2, body h3, body h4 {
          font-family: var(--font-display);
          font-weight: 600;
          color: var(--primary);
          letter-spacing: -0.01em;
        }
      `}</style>
      {/* headerUser only needs name+role for the "Dashboard" button link —
          notifications/avatar/logout live in the dashboard's own header now,
          not duplicated here (see site-header.tsx), so the inquiries-count
          and avatar-photo queries this layout used to run are gone too. */}
      <SiteHeader user={headerUser} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
