"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { signupRoles, type SignupRole } from "@/types/signup-role";

export { signupRoles };
export type { SignupRole };

export function RoleSelect({
  value,
  onChange,
  name = "role",
}: {
  value?: SignupRole;
  onChange?: (role: SignupRole) => void;
  name?: string;
}) {
  const t = useTranslations("signup.roleSelect");
  const [selected, setSelected] = useState<SignupRole>(value ?? "student");

  function select(role: SignupRole) {
    setSelected(role);
    onChange?.(role);
  }

  return (
    <div role="radiogroup" aria-label={t("label")} className="grid grid-cols-2 gap-2.5">
      {signupRoles.map((role) => (
        <button
          key={role}
          type="button"
          role="radio"
          aria-checked={selected === role}
          onClick={() => select(role)}
          className={cn(
            "rounded-md border p-3 text-left transition-colors",
            selected === role ? "border-primary bg-secondary/50" : "border-border bg-white hover:border-input",
          )}
        >
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-wide text-accent-deep">
            {t(`${role}.tag`)}
          </span>
          <span className="block text-sm font-semibold text-foreground">{t(`${role}.label`)}</span>
        </button>
      ))}
      <input type="hidden" name={name} value={selected} />
    </div>
  );
}
