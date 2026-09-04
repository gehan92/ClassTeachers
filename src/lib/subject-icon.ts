import {
  Atom,
  Code,
  FlaskConical,
  Globe,
  GraduationCap,
  Landmark,
  Languages,
  Microscope,
  Palette,
  ScrollText,
  Sigma,
  type LucideIcon,
} from "lucide-react";

/**
 * Keyword match on the subject's English name against the common Sri
 * Lankan O/L/A/L curriculum — the subject taxonomy (0007) is admin-curated
 * and open-ended, not a fixed enum, so this can't be an exact lookup table.
 * Anything that doesn't match falls back to the generic graduation cap,
 * which is what every subject showed before this — an unmatched subject is
 * never worse off than the status quo, just not more specific.
 */
const SUBJECT_ICON_RULES: [RegExp, LucideIcon][] = [
  [/math/i, Sigma],
  [/physic/i, Atom],
  [/chemist/i, FlaskConical],
  [/biolog/i, Microscope],
  [/\bscience\b/i, FlaskConical],
  [/\b(ict|computer|programming|software)\b/i, Code],
  [/\b(english|sinhala|tamil|language|french|german|japanese|chinese|literature)\b/i, Languages],
  [/\b(commerce|account|business|economic)/i, Landmark],
  [/geograph/i, Globe],
  [/histor/i, ScrollText],
  [/\b(art|danc|music|drama|aesthetic)/i, Palette],
];

export function getSubjectIcon(subjectName: string | null | undefined): LucideIcon {
  if (!subjectName) return GraduationCap;
  const match = SUBJECT_ICON_RULES.find(([pattern]) => pattern.test(subjectName));
  return match ? match[1] : GraduationCap;
}
