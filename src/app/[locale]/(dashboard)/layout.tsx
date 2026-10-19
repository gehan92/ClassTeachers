import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";

/**
 * Dashboards use far more translations than the public site, so the root
 * layout leaves them out (see i18n/client-messages.ts) and this layout
 * hands the full set to every screen in here.
 */
export default async function DashboardMessagesLayout({ children }: { children: React.ReactNode }) {
  const messages = await getMessages();
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
