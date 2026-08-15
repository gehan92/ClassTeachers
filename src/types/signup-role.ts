/**
 * The role choices offered at signup (src/components/features/role-select.tsx)
 * and validated server-side (src/lib/auth/schemas.ts). Kept in its own
 * neutral module rather than declared inside role-select.tsx: that file is
 * "use client", and a plain value export from a client-boundary module isn't
 * reliably carried into the server bundle a Server Action runs in.
 */
export const signupRoles = ["student", "teacher", "class", "lecturer"] as const;
export type SignupRole = (typeof signupRoles)[number];
