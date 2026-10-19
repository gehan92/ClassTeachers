import { permanentRedirect } from "next/navigation";

/**
 * ClassPortals' own prices are the ad plans on the Advertise page (tutoring
 * rates are on each teacher's ad), so old /pricing links land there instead
 * of on an empty "coming soon" page.
 */
export default async function PricingPage({ params }: PageProps<"/[locale]/pricing">) {
  const { locale } = await params;
  permanentRedirect(`/${locale}/advertise#plans`);
}
