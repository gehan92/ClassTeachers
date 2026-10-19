/** Domain types for the School dashboard (School Mode, 0166). */

import type { SchoolMedium, SchoolScopeKind, SchoolStatus, SchoolType } from "@/types/database";
import type { PermissionGrant, SchoolAction, SchoolArea } from "@/lib/school/catalog";

export type SchoolDetails = {
  id: string;
  name: string;
  slug: string;
  schoolType: SchoolType;
  district: string;
  address: string;
  registrationNumber: string;
  mediums: SchoolMedium[];
  gradeFrom: number;
  gradeTo: number;
  contactPhone: string;
  contactEmail: string;
  website: string;
  status: SchoolStatus;
  decisionReason: string | null;
  submittedAt: string;
  decidedAt: string | null;
};

export type SchoolRoleRow = {
  id: string;
  key: string;
  /** Custom roles: the name the Principal typed. Built-in roles are shown translated by key instead. */
  name: string;
  description: string;
  isSystem: boolean;
  scopeKind: SchoolScopeKind;
  memberCount: number;
  permissions: PermissionGrant[];
};

export type SchoolApprovalStatus = "pending" | "approved" | "rejected" | "cancelled";

export type SchoolApprovalRow = {
  id: string;
  area: string;
  action: string;
  kind: string;
  summary: string;
  status: SchoolApprovalStatus;
  requesterName: string;
  deciderName: string | null;
  decisionNote: string | null;
  createdAt: string;
  decidedAt: string | null;
  /** The viewer filed this one (can cancel it, can't decide it). */
  isMine: boolean;
};

export type SchoolHistoryRow = {
  id: number;
  area: string;
  event: string;
  entityLabel: string;
  /** Short "field: old → new" lines, already formatted on the server. */
  changes: { field: string; from: string; to: string }[];
  actorName: string;
  createdAt: string;
  createdAtIso: string;
};

/** "area.action" → what the viewer may do. Missing = not allowed. */
export type SchoolAccessMap = Partial<Record<`${SchoolArea}.${SchoolAction}`, "allow" | "approval">>;
