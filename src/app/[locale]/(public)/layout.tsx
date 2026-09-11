import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { createClient } from "@/lib/supabase/server";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  let headerUser = null;
  let inquiriesCount: number | undefined = undefined;
  let userPhotoUrl: string | null = null;

  if (authUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role, avatar_url")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile) {
      headerUser = { name: profile.full_name, role: profile.role };
      userPhotoUrl = profile.avatar_url;

      // Same bell the dashboard header shows (dashboard-shell.tsx) — surfaced
      // here too so a logged-in teacher/institute/student browsing the
      // public site doesn't have to open the dashboard just to notice a new
      // inquiry or wanted-ad response.
      if (profile.role === "teacher" || profile.role === "campus_lecturer") {
        const { count } = await supabase
          .from("inquiries")
          .select("id", { count: "exact", head: true })
          .eq("owner_type", "teacher")
          .eq("owner_id", authUser.id)
          .eq("status", "new");
        inquiriesCount = count ?? 0;
      } else if (profile.role === "class") {
        const { data: classProfile } = await supabase
          .from("class_profiles")
          .select("id")
          .eq("owner_id", authUser.id)
          .maybeSingle();
        if (classProfile) {
          const { count } = await supabase
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq("owner_type", "class")
            .eq("owner_id", classProfile.id)
            .eq("status", "new");
          inquiriesCount = count ?? 0;
        }
      } else if (profile.role === "student") {
        // No 'new'/'read' filter at the DB layer here (unlike the inquiries
        // count above) — list_wanted_ad_responses_for_student (0073) is
        // already scoped to auth.uid(), so counting client-side matches
        // exactly what student/page.tsx's own unreadResponsesCount does.
        const { data: responseRows } = await supabase.rpc("list_wanted_ad_responses_for_student");
        inquiriesCount = (responseRows ?? []).filter((r) => r.status === "new").length;
      }
    }
  }

  return (
    <>
      {/* Bootstrap adds grid/layout utilities (row/col, d-flex, etc.) for the
          public-page redesign — scoped to this route group only via Next's
          head-hoisting of <link>/<style> rendered inside a nested layout
          (removed automatically when this layout unmounts on client nav).
          Loaded via @import ... layer(bootstrap) so it lands in the
          "bootstrap" cascade layer, whose position is pre-registered in
          globals.css as theme, base, bootstrap, components, utilities —
          above Tailwind's base/preflight reset (so Bootstrap's own
          `.form-control`/`.btn` borders and backgrounds aren't stripped by
          preflight's `border-width: 0` reset) but below Tailwind's
          utilities (so our own brand-color utility classes still win any
          conflict, e.g. against Bootstrap's default link-blue on <a> tags).
          The second <style> block still explicitly strips the underline
          Bootstrap's reboot puts on every <a> — being in a lower layer than
          utilities doesn't make Bootstrap's own decoration/color
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
      <SiteHeader user={headerUser} inquiriesCount={inquiriesCount} userPhotoUrl={userPhotoUrl} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
