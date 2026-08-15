/**
 * Display shape for a review card. Mirrors `reviews` (0015_reviews.sql):
 * reviewer_id -> author, rating, comment -> body, reply_text -> reply.
 * `tag` is UI-only (e.g. which batch a review is about on an institute
 * profile) and has no direct column — it's derived from target_type
 * 'teacher_in_class' joins.
 */
export type ReviewDisplay = {
  id: string;
  author: string;
  date: string;
  rating: number;
  body: string;
  reply?: string;
  tag?: string;
};
