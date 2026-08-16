/**
 * Academic titles offered on the Campus Lecturer signup step
 * (src/components/features/lecturer-fields.tsx) and validated server-side
 * (src/lib/auth/schemas.ts). Stored as free text on
 * teacher_profiles.academic_title — kept as a fixed list at the app layer
 * only, matching how signup-role.ts keeps its list separate from the
 * client-boundary component that renders it.
 */
export const academicTitles = [
  "lecturer",
  "senior_lecturer",
  "assistant_professor",
  "associate_professor",
  "professor",
  "visiting_lecturer",
] as const;
export type AcademicTitle = (typeof academicTitles)[number];
