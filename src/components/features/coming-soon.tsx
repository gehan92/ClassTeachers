import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function ComingSoon({ title, body }: { title: string; body: string }) {
  const t = useTranslations("comingSoon");

  return (
    <section className="py-20">
      <div className="mx-auto max-w-160 px-7 text-center">
        <span className="mb-4 inline-block rounded-full bg-secondary px-3 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-secondary-foreground">
          {t("badge")}
        </span>
        <h1 className="text-[32px]">{title}</h1>
        <p className="mt-3 text-muted-foreground">{body}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-sm border border-input px-5 py-2.75 text-sm font-semibold text-primary transition-all hover:-translate-y-px hover:bg-white"
        >
          {t("backHome")}
        </Link>
      </div>
    </section>
  );
}
