import { redirect } from "next/navigation";

/**
 * "Institutes / classes" (header dropdown, 0143) -- a friendly, memorable
 * URL for what's already a fully-featured view: /teachers?category=class
 * (TeachersSearch's own category filter, complete with grade/price/location
 * filters and pagination). A thin redirect here keeps that one real
 * implementation instead of standing up a second, thinner copy of the same
 * search page.
 */
export default async function InstitutesPage({ params }: PageProps<"/[locale]/institutes">) {
  const { locale } = await params;
  redirect(`/${locale}/teachers?category=class`);
}
