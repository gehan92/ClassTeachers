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

  if (authUser) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, role")
      .eq("id", authUser.id)
      .maybeSingle();
    if (profile) {
      headerUser = { name: profile.full_name, role: profile.role };

      // Same bell the dashboard header shows (dashboard-shell.tsx) — surfaced
      // here too so a logged-in teacher/institute browsing the public site
      // doesn't have to open the dashboard just to notice a new inquiry.
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
      }
    }
  }

  return (
    <>
      <SiteHeader user={headerUser} inquiriesCount={inquiriesCount} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
