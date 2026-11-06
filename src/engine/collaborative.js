// src/engine/collaborative.js
// STRETCH FEATURE: item-based collaborative filtering.
// Idea: "students who struggled with the questions you struggled with also
// struggled with these other questions." We build a question x student matrix of
// outcomes, measure cosine similarity between questions, and for a target student
// recommend questions similar to the ones they got wrong.

/** Cosine similarity between two equal-length numeric vectors. */
export function cosineSimilarity(a, b) {
  if (a.length !== b.length) throw new RangeError("vectors must be equal length");
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Build a vector per question across all students (0 = wrong, 1 = correct,
 * 0 also used for "not attempted" — a deliberate simplification for the NEA).
 * Shared by `collaborativeRecommend` and the Stage-2 ML feature builder so the
 * question x student matrix is only ever assembled in one place.
 * @param {number[]} students ordered list of student ids
 * @param {number[]} questions ordered list of question ids
 * @param {Map<string, number>} outcomes key `${studentId}:${questionId}` -> 1/0
 * @returns {Map<number, number[]>} questionId -> outcome vector
 */
export function buildQuestionVectors(students, questions, outcomes) {
  const vectors = new Map();
  for (const q of questions) {
    vectors.set(q, students.map((s) => outcomes.get(`${s}:${q}`) ?? 0));
  }
  return vectors;
}

/**
 * Average cosine similarity between `questionId` and a set of "seed" questions
 * (e.g. ones the student recently got wrong), using pre-built question vectors.
 * Bounded to [0,1] since outcome vectors only ever contain 0/1 entries. Returns
 * 0 if there are no seeds or no vector is known for the question.
 */
export function cfSimilarityScore(questionId, seedQuestionIds, vectors) {
  const target = vectors.get(questionId);
  if (!target || seedQuestionIds.length === 0) return 0;
  let total = 0, count = 0;
  for (const seed of seedQuestionIds) {
    if (seed === questionId) continue;
    const seedVec = vectors.get(seed);
    if (!seedVec) continue;
    total += cosineSimilarity(target, seedVec);
    count++;
  }
  return count ? total / count : 0;
}

/**
 * @param {object} input
 *   students: number[]                      ordered list of student ids
 *   questions: number[]                     ordered list of question ids
 *   outcomes: Map<string, number>           key `${studentId}:${questionId}` -> 1 correct / 0 wrong
 *   targetStudent: number
 * @param {number} limit
 * @returns {Array<{questionId:number, score:number}>} questions to recommend
 */
export function collaborativeRecommend(input, limit = 5) {
  const { students, questions, outcomes, targetStudent } = input;
  const vectors = buildQuestionVectors(students, questions, outcomes);

  // Questions the target student got wrong are the "seeds".
  const wrong = questions.filter((q) => outcomes.get(`${targetStudent}:${q}`) === 0
    && outcomes.has(`${targetStudent}:${q}`));
  // Questions already attempted (exclude from recommendations).
  const attempted = new Set(questions.filter((q) => outcomes.has(`${targetStudent}:${q}`)));

  const scores = new Map();
  for (const seed of wrong) {
    for (const q of questions) {
      if (attempted.has(q)) continue;
      const sim = cosineSimilarity(vectors.get(seed), vectors.get(q));
      scores.set(q, (scores.get(q) ?? 0) + sim);
    }
  }

  return [...scores.entries()]
    .map(([questionId, score]) => ({ questionId, score: Math.round(score * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
