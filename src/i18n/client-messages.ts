import type { AbstractIntlMessages } from "next-intl";

/**
 * Translations that only dashboard screens use. They are most of the
 * message files (about 80% — 300 KB+ in Tamil), and every page used to send
 * all of them to the browser. The root layout now sends everything except
 * these; the dashboard and admin layouts add a provider with the full set.
 */
const DASHBOARD_ONLY_NAMESPACES = new Set([
  "teacherDashboard",
  "adminDashboard",
  "instituteDashboard",
  "studentDashboard",
  "dashboardShell",
  "dashboardCommon",
  "onboarding",
  "notifications",
  "inquiriesTab",
  "sentInquiriesTab",
  "referEarnPanel",
  "wantedAdsBrowseTab",
  "scheduleSlotEditor",
  "batchJoinCode",
]);

/** The few School Mode labels the public sign-up form needs (school type, district, grades, mediums). */
const SCHOOL_KEYS_FOR_SIGNUP = ["types", "districts", "gradeN", "mediums"];

export function publicClientMessages(messages: AbstractIntlMessages): AbstractIntlMessages {
  const picked: AbstractIntlMessages = {};
  for (const [namespace, value] of Object.entries(messages)) {
    if (DASHBOARD_ONLY_NAMESPACES.has(namespace)) continue;
    if (namespace === "school" && value && typeof value === "object") {
      const school = value as AbstractIntlMessages;
      picked.school = Object.fromEntries(SCHOOL_KEYS_FOR_SIGNUP.filter((k) => k in school).map((k) => [k, school[k]]));
      continue;
    }
    picked[namespace] = value;
  }
  return picked;
}
