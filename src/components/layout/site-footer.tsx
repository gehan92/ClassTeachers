import { useTranslations } from "next-intl";
import { Clock, Mail, MapPin, MessageCircle, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { whatsappLink, type SiteContent } from "@/lib/site-content-schema";

/** "94771234567" -> "+94 77 123 4567", for showing a WhatsApp number to people. */
function formatSriLankanNumber(digits: string): string {
  const match = digits.match(/^94(\d{2})(\d{3})(\d{4})$/);
  return match ? `+94 ${match[1]} ${match[2]} ${match[3]}` : `+${digits}`;
}

export function SiteFooter({ contact }: { contact: SiteContent["contact"] }) {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();
  const whatsapp = whatsappLink(contact.whatsapp);
  const hasContact = Boolean(whatsapp || contact.phone || contact.email || contact.address);

  const linkClass = "transition-colors hover:text-secondary";
  const headingClass = "mb-3.5 font-mono text-xs tracking-wider text-white uppercase";

  return (
    <footer className="mt-auto bg-primary-dark pt-14 pb-10 text-white/70">
      <div className="mx-auto max-w-[1180px] px-5 sm:px-7">
        <div className="mb-10 grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.3fr]">
          <div className="col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2.5 font-display text-xl font-bold text-white">
              <span className="flex size-8 items-center justify-center rounded-[7px] bg-secondary font-mono text-[13px] font-bold text-primary-dark">
                CP
              </span>
              ClassPortals
            </div>
            <p className="mt-3 max-w-[34ch] text-sm text-white/60">{t("tagline")}</p>
          </div>

          <nav aria-label={t("discover")}>
            <h2 className={headingClass}>{t("discover")}</h2>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link href={{ pathname: "/teachers", query: { category: "teacher" } }} className={linkClass}>{t("findTeachers")}</Link></li>
              <li><Link href={{ pathname: "/teachers", query: { category: "class" } }} className={linkClass}>{t("findClasses")}</Link></li>
              <li><Link href="/requests" className={linkClass}>{t("requests")}</Link></li>
              <li><Link href="/roles" className={linkClass}>{t("howRolesWork")}</Link></li>
            </ul>
          </nav>

          <nav aria-label={t("platform")}>
            <h2 className={headingClass}>{t("platform")}</h2>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link href="/advertise" className={linkClass}>{t("advertise")}</Link></li>
              <li><Link href="/signup?role=class&kind=school" className={linkClass}>{t("forSchools")}</Link></li>
              <li><Link href="/help" className={linkClass}>{t("helpCentre")}</Link></li>
            </ul>
          </nav>

          <nav aria-label={t("legal")}>
            <h2 className={headingClass}>{t("legal")}</h2>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link href="/terms" className={linkClass}>{t("termsOfService")}</Link></li>
              <li><Link href="/privacy" className={linkClass}>{t("privacyPolicy")}</Link></li>
            </ul>
          </nav>

          {hasContact && (
            <div className="col-span-2 lg:col-span-1">
              <h2 className={headingClass}>{t("contact")}</h2>
              <ul className="space-y-2.5 text-sm text-white/70">
                {whatsapp && (
                  <li>
                    <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={`inline-flex items-center gap-2 ${linkClass}`}>
                      <MessageCircle className="size-4 shrink-0 text-cta" aria-hidden />
                      {t("whatsapp")} · {formatSriLankanNumber(contact.whatsapp)}
                    </a>
                  </li>
                )}
                {contact.phone && (
                  <li>
                    <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={`inline-flex items-center gap-2 ${linkClass}`}>
                      <Phone className="size-4 shrink-0 text-cta" aria-hidden />
                      {contact.phone}
                    </a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={`mailto:${contact.email}`} className={`inline-flex items-center gap-2 break-all ${linkClass}`}>
                      <Mail className="size-4 shrink-0 text-cta" aria-hidden />
                      {contact.email}
                    </a>
                  </li>
                )}
                {contact.address && (
                  <li className="flex items-start gap-2">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-cta" aria-hidden />
                    {contact.address}
                  </li>
                )}
                {contact.hours && (
                  <li className="flex items-start gap-2">
                    <Clock className="mt-0.5 size-4 shrink-0 text-cta" aria-hidden />
                    {contact.hours}
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5 text-xs text-white/45">
          <span>{t("copyright", { year })}</span>
          <span className="flex items-center gap-4">
            {contact.facebook && (
              <a href={contact.facebook} target="_blank" rel="noopener noreferrer" className={linkClass}>
                Facebook
              </a>
            )}
            <span>{t("location")}</span>
          </span>
        </div>
      </div>
    </footer>
  );
}
