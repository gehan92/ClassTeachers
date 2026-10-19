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
  /** Last sign-in, formatted — null if they never signed in. */
  lastActive: string | null;
  lastActiveIso: string | null;
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
  status: "pending" | "accepted" | "declined" | "qna_open" | "joined";
  createdAt: string;
};

export type AdminPaymentStatus = "pending" | "completed" | "failed" | "cancelled";

export type AdminPayment = {
  id: string;
  studentName: string;
  purpose: "teacher_connection" | "institute_unlock" | "class_join";
  targetLabel: string;
  amount: number;
  currency: string;
  orderId: string;
  status: AdminPaymentStatus;
  createdAt: string;
  createdAtIso: string;
  paidAt: string | null;
};

export type AuditLogEntry = {
  id: string;
  actorName: string;
  action: string;
  targetLabel: string;
  /** Short human-readable extras from metadata (decision, reason, role…). */
  details: string;
  createdAt: string;
};

export type ModerationItem = {
  id: string;
  kind: "note" | "exam" | "assignment" | "ad" | "wantedAd";
  title: string;
  ownerName: string;
  /** e.g. "Past paper", "Homework", "Draft" — a short qualifier, may be empty. */
  detail: string;
  createdAt: string;
  createdAtIso: string;
  /** Public page for this item, when one exists. */
  viewHref: string | null;
};

export type PlatformFeatureState = {
  key: "signups" | "aiPdfImport" | "wantedAds" | "liveClasses";
  enabled: boolean;
};

export type AdminReferral = {
  id: string;
  referrerName: string;
  referredName: string;
  rewardStatus: "pending" | "granted" | "declined";
  createdAt: string;
};

// ---------------------------------------------------------------- reports

/** The date ranges every admin report can be viewed over. */
export type ReportRange = "7d" | "30d" | "90d" | "12m";

/**
 * One aggregated cell of a daily series: on Sri Lanka day `d`
 * (YYYY-MM-DD), category `k` had value `n` (a count, or rupees for money
 * series). Charts sum these over the selected range and bucket them by
 * day, week or month on the client.
 */
export type DailyCount = { d: string; k: string; n: number };

export type RoleActivity = {
  role: PlatformUserRole;
  total: number;
  active7: number;
  active30: number;
  /** Finished the onboarding wizard (profiles.profile_completed_at). */
  onboarded: number;
};

export type AdminReports = {
  /** Today's Sri Lanka date, YYYY-MM-DD — the right edge of every chart. */
  todayKey: string;
  totals: {
    users: number;
    students: number;
    teachers: number;
    lecturers: number;
    institutes: number;
    batches: number;
    studentsInClasses: number;
    notes: number;
    exams: number;
    questions: number;
    assignments: number;
    liveClasses: number;
    reviews: number;
    activeAds: number;
    adViewsTotal: number;
    openWantedAds: number;
  };
  activity: RoleActivity[];
  activeToday: number;
  active7: number;
  active30: number;
  /** Top locations typed on profiles, case-folded. */
  locations: { k: string; n: number }[];
  daily: {
    /** k = PlatformUserRole */
    signups: DailyCount[];
    /** k = payment purpose, n = rupees (completed payments only) */
    earnings: DailyCount[];
    /** k = payment status, n = payments */
    payments: DailyCount[];
    /** k = enrollment status at the time of loading */
    requests: DailyCount[];
    /** k = "paid" | "waived" — joins that went through the platform fee step */
    feeJoins: DailyCount[];
    inquiries: DailyCount[];
    /** k = "teacher" | "class" */
    batches: DailyCount[];
    examsCreated: DailyCount[];
    /** k = submission status */
    examsTaken: DailyCount[];
    /** k = live class mode */
    liveClasses: DailyCount[];
    /** k = attendance status */
    attendance: DailyCount[];
    /** k = "note" | "assignment" | "question" */
    content: DailyCount[];
    /** k = star rating "1".."5" */
    reviews: DailyCount[];
    /** k = "posted" | "answered" */
    wantedAds: DailyCount[];
    /** n = rupees recorded by institutes (school-side money, not ClassPortals revenue) */
    feeCollections: DailyCount[];
    /** k = audit action group: "contentRemoved" | "suspended" | "reviewRemoved" | "rejected" | "approved" */
    moderation: DailyCount[];
    /** k = owner key ("teacher:<id>" / "class:<id>"), n = rupees */
    earnersByOwner: DailyCount[];
    /** k = "score", n = percent — one row per graded exam submission */
    examScores: DailyCount[];
  };
  ownerNames: Record<string, { name: string; kind: "teacher" | "institute" }>;
  /** Students in class per subject, all time. */
  subjects: { k: string; n: number }[];
  /** Question bank size per subject. */
  questionsBySubject: { k: string; n: number }[];
  approvalStats: { pending: number; approved: number; rejected: number; avgDecisionDays: number | null };
};

export type TrafficReport = {
  firstVisitAt: string | null;
  totals: { visits: number; visitors: number; signedInUsers: number; publicVisits: number };
  daily: { d: string; visits: number; visitors: number }[];
  pages: { path: string; n: number; visitors: number }[];
  ads: { id: string; title: string; n: number; visitors: number }[];
  referrers: { k: string; n: number }[];
  devices: { k: string; n: number }[];
  locales: { k: string; n: number }[];
  roles: { k: string; n: number }[];
  features: { k: string; n: number; users: number }[];
  searches: { term: string; n: number; noResults: number }[];
};

/** null = tracking isn't set up yet (migration 0165 not run). */
export type TrafficReportResult = { report: TrafficReport | null; error?: string };

export type ContentReportTarget = "ad" | "teacher" | "institute" | "review" | "wanted_ad";
export type ContentReportReason = "spam" | "fake" | "inappropriate" | "scam" | "other";

export type AdminContentReport = {
  id: string;
  targetType: ContentReportTarget;
  targetId: string;
  targetLabel: string;
  /** Public page for the reported item, when it has one. */
  targetHref: string | null;
  reason: ContentReportReason;
  details: string;
  reporterName: string;
  status: "open" | "resolved" | "dismissed";
  resolutionNote: string;
  createdAt: string;
  createdAtIso: string;
  /** How many open reports point at this same item. */
  sameTargetCount: number;
};

export type ApprovalDecision = {
  id: string;
  name: string;
  decision: "approved" | "rejected";
  reason: string;
  adminName: string;
  decidedAt: string;
};

export type AdminUserDetail = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  role: PlatformUserRole | "admin";
  location: string | null;
  joinedAt: string;
  lastSignInAt: string | null;
  onboarded: boolean;
  suspended: boolean;
  listingStatus: string | null;
  published: boolean | null;
  verified: boolean | null;
  stats: { label: "classes" | "students" | "enrollments" | "exams" | "notes" | "reviewsReceived" | "reviewsWritten" | "payments" | "spent" | "reports"; value: string }[];
  /** detail = who runs it / when; status = enrolment or batch status, translated on screen. */
  classes: { title: string; detail: string; status: string | null }[];
  payments: { purpose: string; amount: number; status: string; date: string }[];
  adminActions: { action: string; details: string; adminName: string; date: string }[];
  reportsAgainst: number;
};

/** A school registered through School Mode (0166), for Admin -> Approvals. */
export type AdminSchool = {
  id: string;
  name: string;
  principalName: string;
  schoolType: "government" | "private" | "international" | "pirivena";
  district: string;
  registrationNumber: string | null;
  mediums: ("si" | "ta" | "en")[];
  gradeFrom: number;
  gradeTo: number;
  contactPhone: string | null;
  contactEmail: string | null;
  status: "pending" | "approved" | "rejected" | "suspended";
  decisionReason: string | null;
  submittedAt: string;
};
