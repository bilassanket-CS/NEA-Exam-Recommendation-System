// src/engine/mastery.js
// Per-topic mastery estimate in the range 0..1.
// We use an exponential moving average (EMA) of correctness so that recent
// performance counts for more than old performance. This is the signal the
// recommender uses to decide which topics are weakest.

export const DEFAULT_ALPHA = 0.3; // weight given to the most recent attempt

/**
 * Update a topic mastery estimate after one attempt.
 * @param {number} previous mastery in 0..1 (use 0.5 for a brand-new topic)
 * @param {boolean} correct
 * @param {number} alpha smoothing factor 0..1
 * @returns {number} new mastery in 0..1
 */
export function updateMastery(previous, correct, alpha = DEFAULT_ALPHA) {
  if (alpha <= 0 || alpha > 1) throw new RangeError("alpha must be in (0,1]");
  const outcome = correct ? 1 : 0;
  const next = previous + alpha * (outcome - previous);
  return clamp01(next);
}

/**
 * Rank topics from weakest to strongest.
 * @param {Array<{topicId:number, mastery:number}>} topics
 * @param {number} n how many to return (default: all)
 * @returns {Array<{topicId:number, mastery:number}>}
 */
export function weakestTopics(topics, n = topics.length) {
  return [...topics].sort((a, b) => a.mastery - b.mastery).slice(0, n);
}

/** A simple overall "exam readiness" estimate: the average mastery, as a %. */
export function readiness(topics) {
  if (topics.length === 0) return 0;
  const avg = topics.reduce((s, t) => s + t.mastery, 0) / topics.length;
  return Math.round(avg * 100);
}

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}
