"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/features/status-badge";
import { useDashboardRefresh } from "@/lib/hooks/use-dashboard-refresh";
import { respondToWantedAdDecision } from "@/lib/dashboard/wanted-ads-actions";
import type { WantedAdRow, WantedAdResponseRow } from "@/components/dashboard/student/wanted-ads-tab";

/**
 * Split out of "Post an Ad" (Gehan wanted managing an ad kept separate from
 * acting on what came in) — grouped by ad so a response is never shown
 * without the context of which ad it's replying to. Accepting/declining is
 * final, same shape as respondToJoinRequest: Accept just marks the response
 * so (no automatic contact-info reveal — the student reaches out the same
 * way they always would), Decline closes it out.
 */
export function WantedAdResponsesTab({
  wantedAds,
  responses,
}: {
  wantedAds: WantedAdRow[];
  responses: WantedAdResponseRow[];
}) {
  const t = useTranslations("studentDashboard.wantedAdResponses");

  const adsWithResponses = wantedAds
    .map((ad) => ({ ad, responses: responses.filter((r) => r.wantedAdId === ad.id) }))
    .filter((group) => group.responses.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl">{t("heading")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {adsWithResponses.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="flex flex-col gap-4">
          {adsWithResponses.map(({ ad, responses: adResponses }) => (
            <div key={ad.id} className="rounded-lg border border-border bg-white p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-base font-medium text-foreground">{ad.title}</h4>
                <span className="text-xs font-semibold text-muted-foreground">
                  {t("responsesHeading", { count: adResponses.length })}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {adResponses.map((response) => (
                  <ResponseItem key={response.id} response={response} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ResponseItem({ response }: { response: WantedAdResponseRow }) {
  const t = useTranslations("studentDashboard.wantedAdResponses");
  const { refresh } = useDashboardRefresh();
  const [deciding, setDeciding] = useState(false);
  const [status, setStatus] = useState(response.status);

  async function handleDecision(accepted: boolean) {
    setDeciding(true);
    const result = await respondToWantedAdDecision(response.id, accepted);
    setDeciding(false);
    if (result.error) return;
    setStatus(accepted ? "accepted" : "declined");
    refresh();
  }

  const decided = status === "accepted" || status === "declined";

  return (
    <div className="rounded-md bg-secondary/60 px-3 py-2">
      <div className="mb-0.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">
            {response.responderName ?? t(`responderTypeLabels.${response.responderType}`)}
            {" · "}
            {t(`responderTypeLabels.${response.responderType}`)}
          </span>
          {status === "new" && <StatusBadge variant="pending">{t("newResponseBadge")}</StatusBadge>}
          {status === "accepted" && <StatusBadge variant="active">{t("statusAccepted")}</StatusBadge>}
          {status === "declined" && <StatusBadge variant="flagged">{t("statusDeclined")}</StatusBadge>}
        </div>
        <span className="text-xs text-muted-foreground">{response.createdLabel}</span>
      </div>
      <p className="text-sm text-foreground/85">{response.message}</p>
      {!decided && (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={() => handleDecision(true)} disabled={deciding}>
            {t("acceptResponse")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => handleDecision(false)} disabled={deciding}>
            {t("declineResponse")}
          </Button>
        </div>
      )}
    </div>
  );
}
