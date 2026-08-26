"use client";

import { Suspense, useActionState, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AuthShell } from "@/components/features/auth-shell";
import { RoleSelect, type SignupRole } from "@/components/features/role-select";
import { signupRoles } from "@/types/signup-role";
import { TeacherFields } from "@/components/features/teacher-fields";
import { LecturerFields } from "@/components/features/lecturer-fields";
import { InstituteFields } from "@/components/features/institute-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { signUpAction } from "@/lib/auth/actions";

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const t = useTranslations("signup");
  const stats = t.raw("stats") as { value: string; label: string }[];
  // A link into signup can pre-pick a role via ?role= (e.g. the /advertise
  // page's "I'm a teacher" / "I'm an institute" CTAs) — falls back to the
  // default student role for a plain /signup visit or an unrecognized value.
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const initialRole = (signupRoles as readonly string[]).includes(roleParam ?? "")
    ? (roleParam as SignupRole)
    : "student";
  const [role, setRole] = useState<SignupRole>(initialRole);
  const [state, formAction, pending] = useActionState(signUpAction, undefined);

  if (state?.pendingConfirmationEmail) {
    return (
      <AuthShell quote={t("sideQuote")} stats={stats}>
        <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
          {t("pendingConfirmation.eyebrow")}
        </div>
        <h1 className="text-[26px]">{t("pendingConfirmation.title")}</h1>
        <p className="mb-6.5 text-sm text-muted-foreground">
          {t("pendingConfirmation.body", { email: state.pendingConfirmationEmail })}
        </p>
        <Link href="/login" className="font-semibold text-primary">
          {t("pendingConfirmation.backToLogin")}
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell quote={t("sideQuote")} stats={stats}>
      <div className="mb-2.5 inline-flex items-center gap-2 font-mono text-xs tracking-[0.12em] text-accent-deep uppercase before:inline-block before:h-px before:w-4 before:bg-accent-deep before:content-['']">
        {t("eyebrow")}
      </div>
      <h1 className="text-[26px]">{t("title")}</h1>
      <p className="mb-6.5 text-sm text-muted-foreground">{t("subtitle")}</p>

      <form action={formAction} className="space-y-4">
        <RoleSelect value={role} onChange={setRole} />

        {role === "teacher" && <TeacherFields />}
        {role === "lecturer" && <LecturerFields />}
        {role === "class" && <InstituteFields />}

        <div className="grid gap-1.5">
          <Label htmlFor="name">{role === "class" ? t("contactPersonLabel") : t("nameLabel")}</Label>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder={role === "class" ? t("contactPersonPlaceholder") : t("namePlaceholder")}
            required
            minLength={2}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input id="email" name="email" type="email" placeholder={t("emailPlaceholder")} required />
        </div>
        {role !== "student" && (
          <div className="grid gap-1.5">
            <Label htmlFor="phone">{t("phoneLabel")}</Label>
            <Input id="phone" name="phone" type="tel" placeholder={t("phonePlaceholder")} />
          </div>
        )}
        <div className="grid gap-1.5">
          <Label htmlFor="password">{t("passwordLabel")}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder={t("passwordPlaceholder")}
            required
            minLength={8}
          />
          <p className="text-xs text-muted-foreground">{t("passwordHelper")}</p>
        </div>

        <label className="flex items-start gap-2 text-[13px] text-muted-foreground">
          <Checkbox name="agree" required className="mt-0.5" />
          <span>
            {t("agreeText")} <Link href="/terms" className="font-semibold text-primary">{t("termsLink")}</Link>{" "}
            {t("agreeAnd")}{" "}
            <Link href="/privacy" className="font-semibold text-primary">{t("privacyLink")}</Link>
          </span>
        </label>

        {state?.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

        <Button
          type="submit"
          disabled={pending}
          className="h-auto w-full rounded-sm bg-primary px-5 py-2.75 text-sm text-primary-foreground hover:bg-primary-light"
        >
          {pending ? t("submitting") : t("submit")}
        </Button>
      </form>

      <div className="mt-5.5 text-center text-sm text-muted-foreground">
        {t("footerPrompt")}{" "}
        <Link href="/login" className="font-semibold text-primary">
          {t("footerLink")}
        </Link>
      </div>
    </AuthShell>
  );
}
