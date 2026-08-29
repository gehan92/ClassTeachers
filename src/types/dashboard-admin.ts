/** Domain types for the Admin dashboard. */

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
  /** Undefined only for role: "student" — every other role can opt into verification (0075, extended to teacher/institute by 0087). An admin-toggled credential badge. */
  institutionVerified: boolean | undefined;
  /** Undefined only for role: "student" — whether a verification document has been submitted (0076/0087); gates whether the Verify button can be used at all. */
  hasVerificationDocument: boolean | undefined;
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

export type AdminReferral = {
  id: string;
  referrerName: string;
  referredName: string;
  rewardStatus: "pending" | "granted" | "declined";
  createdAt: string;
};
