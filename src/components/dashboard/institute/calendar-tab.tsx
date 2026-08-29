"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { StatusBadge } from "@/components/features/status-badge";

export type InstituteCalendarSession = {
  id: string;
  title: string;
  scheduledAtIso: string;
  durationMinutes: number;
  mode: "online" | "physical";
  location: string | null;
  batchTitle: string | null;
  teacherName: string | null;
};

type SessionState = "upcoming" | "live" | "ended";

function sessionState(row: InstituteCalendarSession, nowMs: number): SessionState {
  const start = new Date(row.scheduledAtIso).getTime();
  const end = start + row.durationMinutes * 60 * 1000;
  if (nowMs >= start && nowMs <= end) return "live";
  if (nowMs > end) return "ended";
  return "upcoming";
}

/**
 * Institute Blueprint step 6 — "one calendar, every linked teacher's live
 * sessions rolled up in one institute-wide view." No calendar library is
 * used anywhere in the app (recharts is the only chart dependency), and
 * every existing live-class surface (teacher/student dashboards) is a flat
 * sorted table rather than a grid — so this follows that same convention:
 * a day-grouped agenda list rather than a month grid, built from the same
 * data the institute Analytics tab already fetches (no new query).
 */
export function CalendarTab({ sessions }: { sessions: InstituteCalendarSession[] }) {
  const t = useTranslations("instituteDashboard.calendar");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const dayFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }), []);
  const timeFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }), []);

  const groups = useMemo(() => {
    const sorted = [...sessions].sort((a, b) => new Date(a.scheduledAtIso).getTime() - new Date(b.scheduledAtIso).getTime());
    const byDay = new Map<string, InstituteCalendarSession[]>();
    for (const session of sorted) {
      const date = new Date(session.scheduledAtIso);
      const key = date.toDateString();
      const list = byDay.get(key) ?? [];
      list.push(session);
      byDay.set(key, list);
    }
    return [...byDay.entries()].map(([key, list]) => ({
      key,
      label: dayFormatter.format(new Date(list[0].scheduledAtIso)),
      sessions: list,
    }));
  }, [sessions, dayFormatter]);

  const todayKey = new Date(now).toDateString();
  const upcomingGroups = groups.filter((g) => new Date(g.sessions[0].scheduledAtIso).toDateString() >= todayKey);
  const pastGroups = groups
    .filter((g) => new Date(g.sessions[0].scheduledAtIso).toDateString() < todayKey)
    .slice(-7);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl text-primary">{t("title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-border bg-white p-5 text-sm text-muted-foreground">{t("empty")}</div>
      ) : (
        <div className="flex flex-col gap-8">
          {upcomingGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noUpcoming")}</p>
          ) : (
            <div className="flex flex-col gap-5">
              {upcomingGroups.map((group) => (
                <DayGroup key={group.key} label={group.label} sessions={group.sessions} now={now} timeFormatter={timeFormatter} t={t} />
              ))}
            </div>
          )}

          {pastGroups.length > 0 && (
            <div className="flex flex-col gap-5">
              <h3 className="text-sm font-medium text-muted-foreground">{t("recentlyEnded")}</h3>
              {pastGroups.map((group) => (
                <DayGroup key={group.key} label={group.label} sessions={group.sessions} now={now} timeFormatter={timeFormatter} t={t} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DayGroup({
  label,
  sessions,
  now,
  timeFormatter,
  t,
}: {
  label: string;
  sessions: InstituteCalendarSession[];
  now: number;
  timeFormatter: Intl.DateTimeFormat;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-foreground">{label}</h3>
      <div className="rounded-lg border border-border bg-white">
        {sessions.map((session, i) => {
          const state = sessionState(session, now);
          return (
            <div
              key={session.id}
              className={`flex flex-wrap items-center justify-between gap-3 p-4 ${i !== sessions.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span className="w-16 shrink-0 font-mono text-[13px] text-muted-foreground">
                  {timeFormatter.format(new Date(session.scheduledAtIso))}
                </span>
                <div>
                  <p className="font-medium text-foreground">{session.title}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {[session.batchTitle, session.teacherName, session.mode === "online" ? t("online") : session.location]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              </div>
              {state === "live" && <StatusBadge variant="active">{t("stateLive")}</StatusBadge>}
              {state === "ended" && <StatusBadge variant="closed">{t("stateEnded")}</StatusBadge>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
