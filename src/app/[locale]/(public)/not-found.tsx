import { useTranslations } from "next-intl";
import { ArrowRight, Compass } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { SearchCard } from "@/components/features/search-card";

/**
 * Shown inside the normal site header and footer whenever a public page
 * doesn't exist — a removed ad, a mistyped address, an old link — with a
 * search box and the main places to go next, instead of a dead end.
 */
export default function PublicNotFound() {
  const t = useTranslations("notFoundPage");

  const links = [
    { href: "/teachers", label: t("links.teachers") },
    { href: "/requests", label: t("links.requests") },
    { href: "/help", label: t("links.help") },
  ];

  return (
    <section className="bg-[radial-gradient(1000px_380px_at_50%_-10%,rgba(201,150,44,0.14),transparent_60%)] px-5 pt-20 pb-20 sm:pt-28">
      {/* not-found pages can't export metadata; React moves this into <head>. */}
      <title>{t("pageTitle")}</title>
      <div className="mx-auto max-w-[760px] text-center">
        <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primary text-cta">
          <Compass className="size-7" aria-hidden />
        </span>
        <p className="font-mono text-sm tracking-[0.2em] text-accent-deep">404</p>
        <h1 className="mt-2 text-[clamp(1.9rem,4.5vw,2.6rem)] leading-tight text-balance">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-muted-foreground">{t("body")}</p>
        <div className="mt-8 text-left">
          <SearchCard />
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-3 text-sm font-semibold">
          <Link href="/" className="text-primary hover:text-accent-deep">
            {t("links.home")}
          </Link>
          {links.map((link) => (
            <Link key={link.href} href={link.href} className="inline-flex items-center gap-1 text-accent-deep hover:text-primary">
              {link.label}
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
