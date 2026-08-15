"use client";

import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { usePathname, useRouter } from "@/i18n/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Same five roles as the signup role picker (src/components/features/role-select.tsx)
// plus admin, which isn't self-served at signup. Teacher and Campus Lecturer
// share the same dashboard — "same tools, campus level" per the product spec —
// so both route to /teacher.
const roles = ["student", "teacher", "class", "lecturer", "admin"] as const;
type DemoRole = (typeof roles)[number];

const roleHref: Record<DemoRole, string> = {
  student: "/student",
  teacher: "/teacher",
  class: "/institute",
  lecturer: "/teacher",
  admin: "/admin",
};

export function DemoRoleSwitcher({ current }: { current: DemoRole }) {
  const t = useTranslations("demoSwitcher");
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(role: DemoRole) {
    if (roleHref[role] === pathname) return;
    router.push(roleHref[role]);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-2.5 py-1 text-xs text-white/80 hover:bg-white/10"
      >
        <span className="hidden sm:inline text-white/50">{t("viewingAs")}</span>
        <span className="font-semibold text-white">{t(current)}</span>
        <ChevronDown className="size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {roles.map((role) => (
          <DropdownMenuItem
            key={role}
            onClick={() => switchTo(role)}
            className={role === current ? "font-semibold text-primary" : undefined}
          >
            {t(role)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type { DemoRole };
