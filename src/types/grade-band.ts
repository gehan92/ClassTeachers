/**
 * Grade-level bands used across search filtering (Listing) and the exam
 * system (QuestionBankItem/ExamDef) — one canonical union so both areas
 * stay in sync instead of re-typing the literal list.
 */
export type GradeBand = "1-5" | "6-9" | "10-11" | "12-13" | "campus";
