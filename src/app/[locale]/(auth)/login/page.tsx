"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { logInAction } from "@/lib/auth/actions";

export default function LoginPage() {
  const t = useTranslations("login");
  const stats = t.raw("stats") as { value: string; label: string }[];
  const [state, formAction, pending] = useActionState(logInAction, undefined);

  return (
    <AuthShell quote={t("sideQuote")} stats={stats}>
      <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
        {t("eyebrow")}
      </div>
      <h1 className="text-[26px]">{t("title")}</h1>
      <p className="mb-6.5 text-sm text-muted-foreground">{t("subtitle")}</p>

      <form action={formAction} className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" name="email" type="text" placeholder={t("emailPlaceholder")} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Input id="password" name="password" type="password" placeholder={t("passwordPlaceholder")} required />
        </div>

        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-muted-foreground">
            <Checkbox name="remember" /> {t("rememberMe")}
          </label>
          <Link href="/forgot-password" className="font-semibold text-primary">
            {t("forgotPassword")}
          </Link>
        </div>

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
        >
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-[12.5px] text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        {t("divider")}
        <span className="h-px flex-1 bg-border" />
      </div>

      <Button
        type="button"
        variant="outline"
        className="h-auto w-full rounded-sm border-input px-5 py-2.75 text-sm text-primary"
      >
        {t("google")}
      </Button>

      <div className="mt-5.5 text-center text-sm text-muted-foreground">
        {t("footerPrompt")}{" "}
        <Link href="/signup" className="font-semibold text-primary">
          {t("footerLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
