import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-10 bg-primary-dark py-12 text-white/70">
      <div className="mx-auto max-w-[1180px] px-7">
        <div className="mb-8 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5 font-display text-xl font-bold text-white">
              <span className="flex size-8 items-center justify-center rounded-[7px] bg-secondary font-mono text-[13px] font-bold text-primary-dark">
                CP
              </span>
              ClassPortals
            </div>
            <p className="mt-2.5 max-w-[32ch] text-sm text-white/60">{t("tagline")}</p>
          </div>

          <div>
            <h4 className="mb-3.5 font-mono text-xs uppercase tracking-wider text-white">
              {t("discover")}
            </h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link href={{ pathname: "/teachers", query: { category: "teacher" } }} className="hover:text-secondary">{t("findTeachers")}</Link></li>
              <li><Link href={{ pathname: "/teachers", query: { category: "class" } }} className="hover:text-secondary">{t("findClasses")}</Link></li>
              <li><Link href="/roles" className="hover:text-secondary">{t("howRolesWork")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3.5 font-mono text-xs uppercase tracking-wider text-white">
              {t("platform")}
            </h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link href="/pricing" className="hover:text-secondary">{t("pricing")}</Link></li>
              <li><Link href="/advertise" className="hover:text-secondary">{t("advertise")}</Link></li>
              <li><Link href="/help" className="hover:text-secondary">{t("helpCentre")}</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3.5 font-mono text-xs uppercase tracking-wider text-white">
              {t("legal")}
            </h4>
            <ul className="space-y-2.5 text-sm text-white/60">
              <li><Link href="/terms" className="hover:text-secondary">{t("termsOfService")}</Link></li>
              <li><Link href="/privacy" className="hover:text-secondary">{t("privacyPolicy")}</Link></li>
            </ul>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-white/10 pt-5 text-xs text-white/45">
          <span>{t("copyright", { year })}</span>
          <span>{t("location")}</span>
        </div>
      </div>
    </footer>
  );
}
