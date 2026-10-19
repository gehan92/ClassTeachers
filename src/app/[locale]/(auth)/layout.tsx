import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("nav");
  return (
    <div className="min-h-screen bg-background">
      <div className="px-6 py-5 sm:px-10">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          ← {t("backToSite")}
        </Link>
      </div>
      {children}
    </div>
  );
}
