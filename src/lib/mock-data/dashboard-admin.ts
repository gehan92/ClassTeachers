import type { FlaggedReview, PendingApproval, PlatformUser, SiteAd } from "@/types/dashboard-admin";

/**
 * Placeholder data for Phase 1 (no Supabase project connected yet). Shaped
 * exactly like the real query results — see src/types/dashboard-admin.ts.
 */

export const pendingApprovals: PendingApproval[] = [
  {
    id: "app-1",
    name: "Mr. Ravindu Silva",
    entityType: "teacher",
    submittedAt: "2 days ago",
    documents: [
      { label: "Degree", verified: true },
      { label: "NIC pending", verified: false },
    ],
  },
  {
    id: "app-2",
    name: "Bright Future Academy",
    entityType: "institute",
    submittedAt: "3 days ago",
    documents: [{ label: "Business Reg.", verified: true }],
  },
  {
    id: "app-3",
    name: "Ms. Chathurika Perera",
    entityType: "campus_lecturer",
    submittedAt: "5 hours ago",
    documents: [
      { label: "University ID", verified: true },
      { label: "NIC pending", verified: false },
    ],
  },
  {
    id: "app-4",
    name: "Mr. Kasun Fernando",
    entityType: "teacher",
    submittedAt: "1 day ago",
    documents: [{ label: "NIC pending", verified: false }],
  },
  {
    id: "app-5",
    name: "Horizon Learning Institute — Kandy Branch",
    entityType: "institute",
    submittedAt: "6 days ago",
    documents: [
      { label: "Business Reg.", verified: true },
      { label: "Tax Cert.", verified: true },
    ],
  },
];

export const platformUsers: PlatformUser[] = [
  { id: "u-1", name: "Mr. P. Kumarasinghe", role: "teacher", joinedAt: "Jan 2024", plan: "premium", status: "active" },
  { id: "u-2", name: "Mrs. S. Fonseka", role: "teacher", joinedAt: "Mar 2024", plan: "standard", status: "active" },
  { id: "u-3", name: "Horizon Learning Institute", role: "institute", joinedAt: "Nov 2023", plan: "premium", status: "active" },
  { id: "u-4", name: "Nimal Perera", role: "student", joinedAt: "Jun 2025", plan: null, status: "active" },
  { id: "u-5", name: "Bright Future Academy", role: "institute", joinedAt: "Feb 2025", plan: "standard", status: "active" },
  { id: "u-6", name: "Ms. N. Rathnayake", role: "teacher", joinedAt: "Aug 2024", plan: "free", status: "suspended" },
  { id: "u-7", name: "Dr. Chathurika Perera", role: "campus_lecturer", joinedAt: "May 2025", plan: "standard", status: "active" },
  { id: "u-8", name: "Ishara Wickramasinghe", role: "student", joinedAt: "Jul 2025", plan: null, status: "active" },
  { id: "u-9", name: "Mr. Kasun Jayawardena", role: "teacher", joinedAt: "Sep 2023", plan: "free", status: "active" },
  { id: "u-10", name: "Colombo Science Campus", role: "institute", joinedAt: "Dec 2024", plan: "premium", status: "suspended" },
];

export const siteAds: SiteAd[] = [
  {
    id: "ad-1",
    sponsor: "Nimal's Bookshop",
    plan: "spotlight",
    placement: "Homepage banner",
    expiresDisplay: "Ends in 2 days",
    status: "expiring",
  },
  {
    id: "ad-2",
    sponsor: "Lanka Stationers",
    plan: "featured",
    placement: "Search results",
    expiresDisplay: "Ends 28 Aug 2026",
    status: "live",
  },
  {
    id: "ad-3",
    sponsor: "ABC Tuition Supplies",
    plan: "basic",
    placement: "Search results",
    expiresDisplay: "Ends 3 Sep 2026",
    status: "live",
  },
  {
    id: "ad-4",
    sponsor: "Kandy Print Shop",
    plan: "featured",
    placement: "Homepage banner",
    expiresDisplay: "Ends in 5 days",
    status: "expiring",
  },
  {
    id: "ad-5",
    sponsor: "Study Hub Essentials",
    plan: "basic",
    placement: "Search results",
    expiresDisplay: "Ends 14 Oct 2026",
    status: "live",
  },
];

export const flaggedReviews: FlaggedReview[] = [
  {
    id: "flag-1",
    targetLabel: "Anonymous review on \"Bright Future Academy\"",
    flaggedAt: "Flagged 4 hours ago",
    rating: 1,
    body: "This place is a scam don't waste your money!!! terrible terrible terrible",
  },
  {
    id: "flag-2",
    targetLabel: "Review on Mr. Ravindu Silva",
    flaggedAt: "Flagged yesterday",
    rating: 2,
    body: "Off-topic rant about a completely different tutor, mentions a person by full name unrelated to this class.",
  },
];
