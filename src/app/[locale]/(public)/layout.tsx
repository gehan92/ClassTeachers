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
      <SiteHeader user={headerUser} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}
