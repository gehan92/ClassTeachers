"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { respondToWantedAd } from "@/lib/dashboard/wanted-ads-actions";

export type WantedAdBrowseRow = {
  id: string;
  lookingFor: "teacher" | "institute";
  subject: string | null;
  mode: "online" | "physical" | "both" | null;
  gradeLevel: string | null;
  title: string;
  description: string | null;
  createdLabel: string;
  myResponse: string | null;
};

/**
 * Shared between the teacher and institute dashboards — same pattern as
 * inquiries-tab.tsx (also shared). Browsing students' wanted ads and
 * responding once is identical for both roles; respondToWantedAd resolves
 * which one the caller actually is server-side.
 */
export function WantedAdsBrowseTab({ requests }: { requests: WantedAdBrowseRow[] }) {
  const t = useTranslations("wantedAdsBrowseTab");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="rounded-lg border border-border bg-white p-5">
        {requests.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {requests.map((request) => (
              <RequestItem key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestItem({ request }: { request: WantedAdBrowseRow }) {
  const t = useTranslations("wantedAdsBrowseTab");

  const [responding, setResponding] = useState(false);
  const [message, setMessage] = useState("");
  const [myResponse, setMyResponse] = useState(request.myResponse);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    if (!message.trim()) return;
    setSending(true);
    setError(null);
    const result = await respondToWantedAd(request.id, message);
    setSending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMyResponse(message);
    setResponding(false);
    setMessage("");
  }

  return (
    <div className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{request.title}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {t(`lookingForOptions.${request.lookingFor}`)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{request.createdLabel}</span>
      </div>
      <p className="text-xs text-muted-foreground">
        {[request.subject, request.mode ? t(`modeOptions.${request.mode}`) : null, request.gradeLevel]
          .filter(Boolean)
          .join(" · ")}
      </p>
      {request.description && <p className="text-sm text-foreground/80">{request.description}</p>}

      {myResponse ? (
        <div className="mt-1 rounded-md bg-secondary/60 px-3 py-2">
          <p className="mb-0.5 text-xs font-semibold text-muted-foreground">{t("yourResponse")}</p>
          <p className="text-sm text-foreground/85">{myResponse}</p>
        </div>
      ) : responding ? (
        <div className="mt-1 flex flex-col gap-2">
          <textarea
            className="min-h-20 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            placeholder={t("responsePlaceholder")}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={handleSend} disabled={sending || !message.trim()}>
              {t("sendResponse")}
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setResponding(false)}>
              {t("cancelReply")}
            </Button>
            {error && <span className="text-sm font-medium text-destructive">{error}</span>}
          </div>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={() => setResponding(true)}>
            {t("respond")}
          </Button>
        </div>
      )}
    </div>
  );
}
