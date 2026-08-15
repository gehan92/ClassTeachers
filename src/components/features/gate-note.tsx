import { Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function GateNote() {
  const t = useTranslations("gateNote");

  return (
    <div className="mb-5 flex items-start gap-2.5 rounded-md border border-lock/20 bg-lock/5 p-3.5 text-sm text-foreground/80">
      <Lock className="mt-0.5 size-4 shrink-0 text-lock" />
      <p className="m-0">
        {t("text")}{" "}
        <Link href="/login" className="font-semibold text-primary underline underline-offset-2">
          {t("signIn")}
        </Link>
      </p>
    </div>
  );
}
