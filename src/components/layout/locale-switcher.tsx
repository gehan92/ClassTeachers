"use client";

import { useLocale, useTranslations } from "next-intl";
import { Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathname, useRouter } from "@/i18n/navigation";
import { localeLabels, locales, type Locale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("language");
  const activeLocale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function switchTo(locale: Locale) {
    router.replace(pathname, { locale });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="sm" aria-label={t("label")} className="gap-1.5 text-primary" />
        }
      >
        <Globe className="size-4" />
        <span className="font-mono text-xs uppercase tracking-wide">{activeLocale}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onClick={() => switchTo(locale)}
            className={locale === activeLocale ? "font-semibold text-primary" : undefined}
          >
            <span className="w-16 shrink-0 font-mono text-xs uppercase text-muted-foreground">
              {locale}
            </span>
            {localeLabels[locale].native}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
