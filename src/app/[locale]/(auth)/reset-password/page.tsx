"use client";

import { useActionState, useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordAction } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const t = useTranslations("resetPassword");
  const [state, formAction, pending] = useActionState(resetPasswordAction, undefined);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mismatchError, setMismatchError] = useState<string | null>(null);
  // /api/auth/confirm already exchanged the emailed link's code for a
  // session before redirecting here — this just confirms that session
  // actually landed (a stale/reused/expired link falls back there to
  // forgot-password instead, but a direct visit to this URL with no code at
  // all would otherwise render a form that can never succeed).
  const [sessionState, setSessionState] = useState<"checking" | "present" | "missing">("checking");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setSessionState(data.user ? "present" : "missing");
    });
  }, []);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault();
      setMismatchError(t("form.mismatchError"));
      return;
    }
    setMismatchError(null);
  }

  if (state?.done) {
    return (
      <AuthShell quote={t("sideQuote")}>
        <div className="text-center">
          <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
            {t("done.eyebrow")}
          </div>
          <h1 className="text-[26px]">{t("done.title")}</h1>
          <p className="mb-6.5 text-sm text-muted-foreground">{t("done.body")}</p>

          <Button
            nativeButton={false}
            render={<Link href="/login" />}
            className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-center text-sm text-primary-foreground hover:bg-primary-light"
          >
            {t("done.cta")}
          </Button>
        </div>
      </AuthShell>
    );
  }

  if (sessionState !== "present") {
    return (
      <AuthShell quote={t("sideQuote")}>
        <div className="text-center">
          <h1 className="text-[26px]">
            {sessionState === "checking" ? t("checking.title") : t("invalidLink.title")}
          </h1>
          <p className="mb-6.5 text-sm text-muted-foreground">
            {sessionState === "checking" ? t("checking.body") : t("invalidLink.body")}
          </p>

          {sessionState === "missing" && (
            <Button
              nativeButton={false}
              render={<Link href="/forgot-password" />}
              className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-center text-sm text-primary-foreground hover:bg-primary-light"
            >
              {t("invalidLink.cta")}
            </Button>
          )}
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell quote={t("sideQuote")}>
      <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
        {t("form.eyebrow")}
      </div>
      <h1 className="text-[26px]">{t("form.title")}</h1>
      <p className="mb-6.5 text-sm text-muted-foreground">{t("form.subtitle")}</p>

      <form action={formAction} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="newPass">{t("form.newPasswordLabel")}</Label>
          <Input
            id="newPass"
            name="password"
            type="password"
            placeholder={t("form.newPasswordPlaceholder")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirmPass">{t("form.confirmPasswordLabel")}</Label>
          <Input
            id="confirmPass"
            name="confirmPassword"
            type="password"
            placeholder={t("form.confirmPasswordPlaceholder")}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {mismatchError || state?.error ? (
          <p className="text-sm text-destructive">{mismatchError ?? state?.error}</p>
        ) : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
        >
          {pending ? t("form.submitting") : t("form.submit")}
        </Button>
      </form>
    </AuthShell>
  );
}
