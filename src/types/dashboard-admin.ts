/**
 * Domain types for the Admin dashboard. Placeholder shapes for Phase 1
 * (no Supabase project connected yet) — see src/lib/mock-data/dashboard-admin.ts
 * for the mock arrays shaped to match these.
 */

export type ApprovalEntityType = "teacher" | "institute" | "campus_lecturer";

export type ApprovalDocument = {
  label: string;
  verified: boolean;
};

export type PendingApproval = {
  id: string;
  name: string;
  entityType: ApprovalEntityType;
  submittedAt: string;
  documents: ApprovalDocument[];
};

export type PlatformUserRole = "teacher" | "institute" | "student" | "campus_lecturer";
export type PlatformUserPlan = "free" | "standard" | "premium" | null;
export type PlatformUserStatus = "active" | "suspended";

export type PlatformUser = {
  id: string;
  name: string;
  role: PlatformUserRole;
  joinedAt: string;
  plan: PlatformUserPlan;
  status: PlatformUserStatus;
};

export type SiteAdPlan = "basic" | "featured" | "spotlight";
export type SiteAdStatus = "expiring" | "live";

export type SiteAd = {
  id: string;
  sponsor: string;
  plan: SiteAdPlan;
  placement: string;
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
