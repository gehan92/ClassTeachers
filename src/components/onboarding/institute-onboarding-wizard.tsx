"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateInstituteProfile } from "@/lib/dashboard/actions";
import { uploadAvatar } from "@/lib/dashboard/avatar-actions";
import { uploadVerificationDocument } from "@/lib/dashboard/verification-actions";
import { completeOnboarding } from "@/lib/onboarding/actions";
import { WizardShell } from "./wizard-shell";

const textareaClass =
  "min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export type InstituteOnboardingInitial = {
  name: string;
  location: string;
  description: string;
  established: string;
  phone: string;
  hourlyRate: string;
  monthlyRate: string;
};

export function InstituteOnboardingWizard({ initial }: { initial: InstituteOnboardingInitial }) {
  const t = useTranslations("onboarding.institute");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [description, setDescription] = useState(initial.description);
  const [established, setEstablished] = useState(initial.established);
  const [phone, setPhone] = useState(initial.phone);
  const [hasDocument, setHasDocument] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  async function persist() {
    return updateInstituteProfile({
      name: initial.name,
      location: initial.location,
      phone,
      established,
      description,
      hourlyRate: initial.hourlyRate,
      monthlyRate: initial.monthlyRate,
    });
  }

  const stepDefs = [
    {
      title: t("step1.title"),
      nextDisabled: !description.trim() || !established.trim(),
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="description">{t("step1.descriptionLabel")}</Label>
            <textarea
              id="description"
              className={textareaClass}
              placeholder={t("step1.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="established">{t("step1.establishedLabel")}</Label>
            <Input
              id="established"
              placeholder={t("step1.establishedPlaceholder")}
              value={established}
              onChange={(e) => setEstablished(e.target.value)}
            />
          </div>
        </>
      ),
    },
    {
      title: t("step2.title"),
      nextDisabled: !phone.trim(),
      body: (
        <>
          <div className="grid gap-1.5">
            <Label htmlFor="phone">{t("step2.phoneLabel")}</Label>
            <Input id="phone" placeholder={t("step2.phonePlaceholder")} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label>{t("step2.documentLabel")}</Label>
            <p className="text-xs text-muted-foreground">{t("step2.documentHint")}</p>
            <label className="mt-1 inline-flex w-fit cursor-pointer items-center justify-center rounded-md border border-input px-3.5 py-1.75 text-sm font-semibold text-primary hover:bg-secondary">
              {docUploading ? t("step2.uploading") : hasDocument ? t("step2.uploaded") : t("step2.upload")}
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={docUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setDocUploading(true);
                  setError(null);
                  const formData = new FormData();
                  formData.set("file", file);
                  const result = await uploadVerificationDocument("class", formData);
                  setDocUploading(false);
                  if (result.error) {
                    setError(result.error);
                    return;
                  }
                  setHasDocument(true);
                }}
              />
            </label>
          </div>
        </>
      ),
    },
    {
      title: t("step3.title"),
      nextDisabled: !photoUrl,
      body: (
        <div className="grid gap-1.5">
          <Label>{t("step3.photoLabel")}</Label>
          <div className="flex items-center gap-3">
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="size-12 shrink-0 rounded-md object-cover" />
            )}
            <label className="inline-flex cursor-pointer items-center justify-center rounded-md border border-input px-3.5 py-1.75 text-sm font-semibold text-primary hover:bg-secondary">
              {photoUploading ? t("step3.uploading") : t("step3.uploadPhoto")}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                disabled={photoUploading}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (!file) return;
                  setPhotoUploading(true);
                  setError(null);
                  const formData = new FormData();
                  formData.set("file", file);
                  formData.set("ownerType", "class");
                  const result = await uploadAvatar(formData);
                  setPhotoUploading(false);
                  if (result.error || !result.url) {
                    setError(result.error ?? "Couldn't upload the image. Please try again.");
                    return;
                  }
                  setPhotoUrl(result.url);
                }}
              />
            </label>
          </div>
        </div>
      ),
    },
  ];

  const stepCount = stepDefs.length;
  const current = stepDefs[step];

  async function handleNext() {
    setSaving(true);
    setError(null);
    const result = await persist();
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (step < stepCount - 1) {
      setStep((s) => s + 1);
      return;
    }
    const finishResult = await completeOnboarding();
    if (finishResult.error) {
      setError(finishResult.error);
      return;
    }
    router.refresh();
  }

  return (
    <WizardShell
      stepIndex={step}
      stepCount={stepCount}
      title={current.title}
      subtitle={t("subtitle")}
      onNext={handleNext}
      onBack={step > 0 ? () => setStep((s) => s - 1) : undefined}
      nextDisabled={current.nextDisabled || photoUploading || docUploading}
      saving={saving}
      error={error}
      isLastStep={step === stepCount - 1}
    >
      {current.body}
    </WizardShell>
  );
}
