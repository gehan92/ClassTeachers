"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/lib/auth/actions";

export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const stats = t.raw("stats") as { value: string; label: string }[];
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, undefined);
  const [resent, setResent] = useState(false);

  if (state?.sent) {
    return (
      <AuthShell quote={t("sideQuote")} stats={stats}>
        <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
          {t("sent.eyebrow")}
        </div>
        <h1 className="text-[26px]">{t("sent.title")}</h1>
        <p className="mb-6.5 text-sm text-muted-foreground">{t("sent.body")}</p>

        <div className="mt-5.5 text-center text-sm text-muted-foreground">
          {t("sent.footerPrompt")}{" "}
          <form action={formAction} className="inline">
            <button
              type="submit"
              disabled={pending}
              className="font-semibold text-primary disabled:opacity-60"
              onClick={() => setResent(true)}
            >
              {resent ? t("sent.resendSent") : t("sent.resend")}
            </button>
          </form>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell quote={t("sideQuote")} stats={stats}>
      <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
        {t("request.eyebrow")}
      </div>
      <h1 className="text-[26px]">{t("request.title")}</h1>
      <p className="mb-6.5 text-sm text-muted-foreground">{t("request.subtitle")}</p>

      <form action={formAction} className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="resetEmail">{t("request.emailLabel")}</Label>
          <Input id="resetEmail" name="email" type="email" placeholder={t("request.emailPlaceholder")} required />
        </div>

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
        >
          {pending ? t("request.submitting") : t("request.submit")}
        </Button>
      </form>

      <div className="mt-5.5 text-center text-sm text-muted-foreground">
        {t("request.footerPrompt")}{" "}
        <Link href="/login" className="font-semibold text-primary">
          {t("request.footerLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
