"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ExternalLink, ImageUp, Loader2, RotateCcw } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/compress-image";
import { saveSiteContent, uploadSitePhoto } from "@/lib/dashboard/site-content-actions";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import {
  AD_PLAN_KEYS,
  CONTACT_LIMITS,
  SITE_LOCALES,
  SITE_PHOTO_SLOTS,
  SITE_SECTIONS,
  SITE_TEXT_FIELDS,
  SITE_TEXT_LIMITS,
  type AdPlanKey,
  type ContactField,
  type LocalizedText,
  type SiteContent,
  type SiteLocale,
  type SitePhotoSlot,
  type SiteTextField,
} from "@/lib/site-content-schema";
import { cn } from "@/lib/utils";

const LANGUAGE_NAMES: Record<SiteLocale, string> = { en: "English", si: "සිංහල", ta: "தமிழ்" };

/** Wide photos (shown full-width behind text) get more pixels than the side-by-side ones. */
const PHOTO_MAX_WIDTH: Record<SitePhotoSlot, number> = {
  hero: 2000,
  cta: 2000,
  advertise: 2000,
  whyUs: 1400,
  howItWorks: 1400,
};

const LONG_FIELDS = new Set<SiteTextField>(["heroSubtitle", "whyUsBody", "howBody", "ctaBody"]);
const CONTACT_FIELDS: ContactField[] = ["whatsapp", "phone", "email", "address", "hours", "facebook"];

/**
 * Admin -> Site content: change the public website's photos, headings and
 * paragraphs (in all three languages), contact details, which homepage
 * sections show, and the ad plan prices — without a developer. Nothing
 * reaches the public site until "Publish changes"; empty text keeps the
 * built-in wording, shown as the placeholder.
 */
export function SiteContentTab({
  initialContent,
  builtInText,
  builtInPhotos,
  builtInPrices,
}: {
  initialContent: SiteContent;
  builtInText: Record<SiteTextField, LocalizedText>;
  builtInPhotos: Record<SitePhotoSlot, string>;
  builtInPrices: Record<AdPlanKey, string>;
}) {
  const t = useTranslations("adminDashboard.siteContent");
  const { refresh } = useDashboardRefresh();
  const [content, setContent] = useState(initialContent);
  const [saved, setSaved] = useState(initialContent);
  const [language, setLanguage] = useState<SiteLocale>("en");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<SitePhotoSlot | null>(null);
  const [photoError, setPhotoError] = useState<{ slot: SitePhotoSlot; text: string } | null>(null);
  const fileInputs = useRef<Partial<Record<SitePhotoSlot, HTMLInputElement | null>>>({});

  const dirty = JSON.stringify(content) !== JSON.stringify(saved);

  function update(next: (draft: SiteContent) => SiteContent) {
    setMessage(null);
    setContent((prev) => next(structuredClone(prev)));
  }

  async function handlePhoto(slot: SitePhotoSlot, file: File | undefined) {
    if (!file) return;
    setPhotoError(null);
    if (!file.type.startsWith("image/")) {
      setPhotoError({ slot, text: t("photos.notImage") });
      return;
    }
    setUploadingSlot(slot);
    try {
      const small = await compressImage(file, PHOTO_MAX_WIDTH[slot]);
      const formData = new FormData();
      formData.set("slot", slot);
      formData.set("file", small);
      const result = await uploadSitePhoto(formData);
      if (result.error || !result.url) {
        setPhotoError({ slot, text: result.error ?? t("photos.uploadFailed") });
      } else {
        const url = result.url;
        update((draft) => {
          draft.photos[slot] = url;
          return draft;
        });
      }
    } catch {
      setPhotoError({ slot, text: t("photos.uploadFailed") });
    } finally {
      setUploadingSlot(null);
      const input = fileInputs.current[slot];
      if (input) input.value = "";
    }
  }

  async function publish() {
    setSaving(true);
    setMessage(null);
    const result = await saveSiteContent(content);
    setSaving(false);
    if (result.error) {
      setMessage({ kind: "error", text: result.error });
      return;
    }
    setSaved(content);
    setMessage({ kind: "ok", text: t("published") });
    refresh();
  }

  const textFilled = (locale: SiteLocale) => SITE_TEXT_FIELDS.filter((f) => content.text[f][locale].trim()).length;

  return (
    <div className="pb-24">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
          <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Link
          href="/"
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
        >
          <ExternalLink className="size-4" />
          {t("viewSite")}
        </Link>
      </div>

      {/* Photos */}
      <Section title={t("photos.title")} description={t("photos.description")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {SITE_PHOTO_SLOTS.map((slot) => {
            const custom = content.photos[slot];
            const src = custom ?? builtInPhotos[slot];
            const busy = uploadingSlot === slot;
            return (
              <div key={slot} className="overflow-hidden rounded-lg border border-border bg-white">
                <div className="relative aspect-video bg-muted">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin preview thumbnail */}
                  <img src={src} alt="" className="size-full object-cover" />
                  <span
                    className={cn(
                      "absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                      custom ? "bg-success text-success-foreground" : "bg-black/60 text-white",
                    )}
                  >
                    {custom ? t("photos.yours") : t("photos.builtIn")}
                  </span>
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-sm font-medium text-white">
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      {t("photos.uploading")}
                    </div>
                  )}
                </div>
                <div className="p-3.5">
                  <div className="text-sm font-semibold text-foreground">{t(`photos.slots.${slot}.name`)}</div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`photos.slots.${slot}.where`)}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <input
                      ref={(el) => {
                        fileInputs.current[slot] = el;
                      }}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      id={`site-photo-${slot}`}
                      onChange={(e) => handlePhoto(slot, e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => fileInputs.current[slot]?.click()}
                    >
                      <ImageUp className="size-4" />
                      {t("photos.change")}
                    </Button>
                    {custom && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() =>
                          update((draft) => {
                            draft.photos[slot] = null;
                            return draft;
                          })
                        }
                      >
                        <RotateCcw className="size-4" />
                        {t("photos.useBuiltIn")}
                      </Button>
                    )}
                  </div>
                  {photoError?.slot === slot && (
                    <p className="mt-2 text-xs font-medium text-destructive" role="alert">
                      {photoError.text}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("photos.tip")}</p>
      </Section>

      {/* Homepage text */}
      <Section title={t("text.title")} description={t("text.description")}>
        <div role="tablist" aria-label={t("text.languageLabel")} className="mb-4 inline-flex rounded-lg border border-border bg-muted p-1">
          {SITE_LOCALES.map((locale) => (
            <button
              key={locale}
              type="button"
              role="tab"
              aria-selected={language === locale}
              onClick={() => setLanguage(locale)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
                language === locale ? "bg-white text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {LANGUAGE_NAMES[locale]}
              {textFilled(locale) > 0 && (
                <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] text-secondary-foreground tabular-nums">
                  {textFilled(locale)}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {SITE_TEXT_FIELDS.map((field) => {
            const value = content.text[field][language];
            const id = `site-text-${field}-${language}`;
            const max = SITE_TEXT_LIMITS[field];
            const Field = LONG_FIELDS.has(field) ? Textarea : Input;
            return (
              <div key={field} className={cn("grid gap-1.5", LONG_FIELDS.has(field) && "lg:col-span-2")}>
                <Label htmlFor={id}>{t(`text.fields.${field}`)}</Label>
                <Field
                  id={id}
                  lang={language}
                  value={value}
                  maxLength={max}
                  placeholder={builtInText[field][language]}
                  {...(LONG_FIELDS.has(field) ? { rows: 2 } : {})}
                  onChange={(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
                    const next = e.target.value;
                    update((draft) => {
                      draft.text[field][language] = next;
                      return draft;
                    });
                  }}
                />
                <span className="flex justify-between text-[11px] text-muted-foreground">
                  <span>{value.trim() ? t("text.custom") : t("text.usingBuiltIn")}</span>
                  <span className="tabular-nums">
                    {value.length} / {max}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Contact */}
      <Section title={t("contact.title")} description={t("contact.description")}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {CONTACT_FIELDS.map((field) => {
            const id = `site-contact-${field}`;
            return (
              <div key={field} className="grid gap-1.5">
                <Label htmlFor={id}>{t(`contact.fields.${field}.label`)}</Label>
                <Input
                  id={id}
                  value={content.contact[field]}
                  maxLength={CONTACT_LIMITS[field]}
                  inputMode={field === "whatsapp" || field === "phone" ? "tel" : field === "email" ? "email" : undefined}
                  placeholder={t(`contact.fields.${field}.placeholder`)}
                  onChange={(e) => {
                    const next = e.target.value;
                    update((draft) => {
                      draft.contact[field] = next;
                      return draft;
                    });
                  }}
                />
                <span className="text-[11px] text-muted-foreground">{t(`contact.fields.${field}.help`)}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Sections */}
      <Section title={t("sections.title")} description={t("sections.description")}>
        <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-white">
          {SITE_SECTIONS.map((section) => (
            <div key={section} className="flex items-start justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{t(`sections.items.${section}.name`)}</div>
                <p className="mt-0.5 text-sm text-muted-foreground">{t(`sections.items.${section}.description`)}</p>
              </div>
              <Switch
                checked={content.sections[section]}
                aria-label={t(`sections.items.${section}.name`)}
                onCheckedChange={(checked) =>
                  update((draft) => {
                    draft.sections[section] = checked;
                    return draft;
                  })
                }
              />
            </div>
          ))}
        </div>
      </Section>

      {/* Ad plans */}
      <Section title={t("plans.title")} description={t("plans.description")}>
        <div className="mb-4 flex items-start justify-between gap-4 rounded-lg border border-border bg-white p-4">
          <div>
            <div className="text-sm font-semibold text-foreground">{t("plans.showName")}</div>
            <p className="mt-0.5 text-sm text-muted-foreground">{t("plans.showDescription")}</p>
          </div>
          <Switch
            checked={content.adPlans.show}
            aria-label={t("plans.showName")}
            onCheckedChange={(checked) =>
              update((draft) => {
                draft.adPlans.show = checked;
                return draft;
              })
            }
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {AD_PLAN_KEYS.map((plan) => {
            const id = `site-plan-${plan}`;
            return (
              <div key={plan} className="grid gap-1.5">
                <Label htmlFor={id}>{t(`plans.names.${plan}`)}</Label>
                <Input
                  id={id}
                  value={content.adPlans.prices[plan]}
                  maxLength={24}
                  placeholder={builtInPrices[plan]}
                  onChange={(e) => {
                    const next = e.target.value;
                    update((draft) => {
                      draft.adPlans.prices[plan] = next;
                      return draft;
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{t("plans.tip")}</p>
      </Section>

      {/* Publish bar */}
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-1 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(14,33,29,0.25)] transition-colors",
          dirty ? "border-cta/50 bg-secondary" : "border-border bg-white",
        )}
      >
        <span
          className={cn(
            "text-sm font-medium",
            message?.kind === "error" ? "text-destructive" : message?.kind === "ok" && !dirty ? "text-success" : "text-foreground",
          )}
          role="status"
        >
          {message ? message.text : dirty ? t("unsaved") : t("upToDate")}
        </span>
        <div className="flex gap-2">
          {dirty && (
            <Button type="button" variant="ghost" disabled={saving} onClick={() => setContent(saved)}>
              {t("discard")}
            </Button>
          )}
          <Button type="button" disabled={!dirty || saving || uploadingSlot !== null} onClick={publish}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            {saving ? t("publishing") : t("publish")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="mt-0.5 mb-4 max-w-[70ch] text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
