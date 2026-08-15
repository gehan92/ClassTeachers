/**
 * Deterministic gradient picker for initials-avatars — same person always
 * gets the same color, different people get visually distinct colors, so a
 * roster table doesn't read as one flat wall of identical circles. Every
 * pair uses existing design tokens (no new colors) and is legible with
 * white text.
 */
const AVATAR_GRADIENTS = [
  "bg-gradient-to-br from-primary to-primary-light",
  "bg-gradient-to-br from-primary-dark to-primary",
  "bg-gradient-to-br from-cta to-accent-deep",
  "bg-gradient-to-br from-accent-deep to-lock",
  "bg-gradient-to-br from-success to-primary-light",
  "bg-gradient-to-br from-cta-hover to-cta",
] as const;

export function avatarGradientClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return AVATAR_GRADIENTS[hash % AVATAR_GRADIENTS.length];
}
