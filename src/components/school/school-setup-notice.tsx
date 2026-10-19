import { useTranslations } from "next-intl";
import { School } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { logOutAction } from "@/lib/auth/actions";

/**
 * Shown instead of the School dashboard when the school record couldn't be
 * created — before migration 0166 has run ("unavailable") or when the
 * sign-up details were incomplete ("failed").
 */
export function SchoolSetupNotice({ reason }: { reason: "unavailable" | "failed" }) {
  const t = useTranslations("school.setupNotice");
  return (
    <main className="flex min-h-dvh items-center justify-center bg-secondary/40 px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-6 text-center shadow-sm sm:p-8">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <School className="size-6" />
        </span>
        <h1 className="mt-4 font-display text-2xl text-primary">{t(`${reason}.title`)}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{t(`${reason}.body`)}</p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link href="/help" className="rounded-sm border border-border px-4 py-2 text-sm font-semibold text-primary hover:bg-muted">
            {t("help")}
          </Link>
          <form action={logOutAction}>
            <button type="submit" className="w-full rounded-sm bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-light">
              {t("logout")}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
