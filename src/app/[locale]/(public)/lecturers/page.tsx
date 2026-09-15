import { redirect } from "next/navigation";

/**
 * "Campus lecturers" (header dropdown, 0143) -- same reasoning as
 * /institutes: a friendly URL redirecting to the existing, fully-featured
 * /teachers?category=campus view rather than a second copy of it.
 */
export default async function LecturersPage({ params }: PageProps<"/[locale]/lecturers">) {
  const { locale } = await params;
  redirect(`/${locale}/teachers?category=campus`);
}
