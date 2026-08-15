"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const stats = t.raw("stats") as { value: string; label: string }[];
  const [step, setStep] = useState<"request" | "sent">("request");
  const [resent, setResent] = useState(false);

  return (
    <AuthShell quote={t("sideQuote")} stats={stats}>
      {step === "request" ? (
        <>
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("request.eyebrow")}
          </div>
          <h1 className="text-[26px]">{t("request.title")}</h1>
          <p className="mb-6.5 text-sm text-muted-foreground">{t("request.subtitle")}</p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep("sent");
            }}
            className="space-y-4"
          >
            <div className="grid gap-1.5">
              <Label htmlFor="resetEmail">{t("request.emailLabel")}</Label>
              <Input id="resetEmail" name="resetEmail" type="email" placeholder={t("request.emailPlaceholder")} />
            </div>

            <Button
              type="submit"
              className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
            >
              {t("request.submit")}
            </Button>
          </form>

          <div className="mt-5.5 text-center text-sm text-muted-foreground">
            {t("request.footerPrompt")}{" "}
            <Link href="/login" className="font-semibold text-primary">
              {t("request.footerLink")}
            </Link>
          </div>
        </>
      ) : (
        <>
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("sent.eyebrow")}
          </div>
          <h1 className="text-[26px]">{t("sent.title")}</h1>
          <p className="mb-6.5 text-sm text-muted-foreground">{t("sent.body")}</p>

          <Button
            nativeButton={false}
            render={<Link href="/reset-password" />}
            className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-center text-sm text-primary-foreground hover:bg-primary-light"
          >
            {t("sent.preview")}
          </Button>

          <div className="mt-5.5 text-center text-sm text-muted-foreground">
            {t("sent.footerPrompt")}{" "}
            <button
              type="button"
              onClick={() => setResent(true)}
              className="font-semibold text-primary"
            >
              {resent ? t("sent.resendSent") : t("sent.resend")}
            </button>
          </div>
        </>
      )}
    </AuthShell>
  );
}
