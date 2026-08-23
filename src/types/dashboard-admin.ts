/**
 * Domain types for the Admin dashboard. Placeholder shapes for Phase 1
 * (no Supabase project connected yet) — see src/lib/mock-data/dashboard-admin.ts
 * for the mock arrays shaped to match these.
 */

export type ApprovalEntityType = "teacher" | "institute" | "campus_lecturer";

export type PendingApproval = {
  id: string;
  name: string;
  entityType: ApprovalEntityType;
  submittedAt: string;
};

export type PlatformUserRole = "teacher" | "institute" | "student" | "campus_lecturer";
export type PlatformUserStatus = "active" | "suspended";

export type PlatformUser = {
  id: string;
  name: string;
  role: PlatformUserRole;
  joinedAt: string;
  status: PlatformUserStatus;
};

export type SiteAdPlan = "basic" | "featured" | "homepage_spotlight";
export type SiteAdPlacement = "search_results" | "homepage_banner" | "homepage_spotlight";
export type SiteAdStatus = "expiring" | "live";

export type SiteAd = {
  id: string;
  sponsor: string;
  plan: SiteAdPlan;
  placement: SiteAdPlacement;
  expiresDisplay: string;
  status: SiteAdStatus;
};

export type FlaggedReview = {
  id: string;
  targetLabel: string;
  flaggedAt: string;
  rating: number;
  body: string;
};

// Read-only oversight of first contact between students and
// teachers/institutes (inquiries + join requests) — for spam/misuse
// monitoring, not a moderation queue like flagged reviews above.
export type ConnectionInquiry = {
  id: string;
  senderName: string;
  senderContact: string;
  targetLabel: string;
  message: string;
  status: "new" | "read";
  createdAt: string;
};

export type ConnectionJoinRequest = {
  id: string;
  studentName: string;
  targetLabel: string;
  status: "pending" | "accepted" | "declined";
  createdAt: string;
};
