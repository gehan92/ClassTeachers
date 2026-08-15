import type { Database } from "@/types/database";

export type UserRole = Database["public"]["Tables"]["profiles"]["Row"]["role"];

/** Where each role lands right after login/signup. */
export const roleDashboardPath: Record<UserRole, string> = {
  student: "/student",
  teacher: "/teacher",
  campus_lecturer: "/teacher",
  class: "/institute",
  admin: "/admin",
};

/** Path prefixes (locale already stripped) that require a signed-in user. */
export const protectedPathPrefixes = ["/student", "/teacher", "/institute", "/admin"] as const;
