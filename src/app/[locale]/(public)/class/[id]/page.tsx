import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ClassProfileView } from "@/components/features/class-profile-view";
import { loadClassProfile } from "@/lib/load-class-profile";
import { createClient } from "@/lib/supabase/server";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/class/[id]">): Promise<Metadata> {
  const { locale, id } = await params;
  const supabase = await createClient();
  const [{ data: classProfile }, t] = await Promise.all([
    supabase.from("class_profiles").select("name").eq("id", id).maybeSingle(),
    getTranslations({ locale, namespace: "meta" }),
  ]);
  if (!classProfile) return {};
  return {
    title: t("classProfileTitle", { name: classProfile.name }),
    description: t("classProfileDescription", { name: classProfile.name }),
  };
}

export default async function ClassProfilePage({
  params,
}: PageProps<"/[locale]/class/[id]">) {
  const { locale, id } = await params;
  setRequestLocale(locale);

  const classProfile = await loadClassProfile(id, locale);
  if (!classProfile) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isStudent = false;
  let generalStatus: "pending" | "accepted" | "declined" | null = null;
  const batchStatusById: Record<string, "pending" | "accepted" | "declined" | null> = {};
  if (user) {
    const [{ data: profile }, { data: enrollmentRows }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).maybeSingle(),
      supabase
        .from("enrollments")
        .select("status, batch_id")
        .eq("student_id", user.id)
        .eq("owner_type", "class")
        .eq("owner_id", classProfile.id),
    ]);
    isStudent = profile?.role === "student";
    for (const row of enrollmentRows ?? []) {
      if (row.batch_id === null) {
        generalStatus = row.status;
      } else {
        batchStatusById[row.batch_id] = row.status;
      }
    }
  }

  return (
    <ClassProfileView
      classProfile={classProfile}
      showGate={!user}
      backHref="/teachers"
      viewerJoin={{ loggedIn: Boolean(user), isStudent, generalStatus, batchStatusById }}
    />
  );
}
