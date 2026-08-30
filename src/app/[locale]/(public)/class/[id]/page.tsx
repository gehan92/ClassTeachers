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

  return <ClassProfileView classProfile={classProfile} showGate={!user} backHref="/teachers" />;
}
