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
      <SiteHeader user={headerUser} inquiriesCount={inquiriesCount} userPhotoUrl={userPhotoUrl} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
