/**
 * Deterministic per-attempt shuffle for exam questions and MCQ options.
 * Seeded from (examId, studentId, attemptNumber) so a reattempt gets a
 * different order than the previous one, but re-rendering the same attempt
 * (e.g. after a refresh, once the order is read back from the server) is
 * reproducible without needing to persist anything beyond the final order
 * itself.
 */

function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function buildAttemptSeed(examId: string, studentId: string, attemptNumber: number): number {
  return hashSeed(`${examId}:${studentId}:${attemptNumber}`);
}

/**
 * Returns a shuffled copy of `questionIds`, and for each MCQ question (found
 * in `optionsByQuestionId`) a shuffled copy of its option id order. Non-MCQ
 * questions are omitted from the returned option-order map.
 */
export function buildShuffledOrder(
  questionIds: string[],
  optionsByQuestionId: Map<string, { id: string }[]>,
  seed: number,
  shuffleQuestions: boolean,
  shuffleOptions: boolean,
): { questionOrder: string[]; optionOrder: Record<string, string[]> } {
  const rand = mulberry32(seed);
  const questionOrder = shuffleQuestions ? shuffle(questionIds, rand) : [...questionIds];
  const optionOrder: Record<string, string[]> = {};
  if (shuffleOptions) {
    for (const qid of questionIds) {
      const options = optionsByQuestionId.get(qid);
      if (options && options.length > 0) {
        optionOrder[qid] = shuffle(options.map((o) => o.id), rand);
      }
    }
  }
  return { questionOrder, optionOrder };
}
