// src/engine/recommender.js
// The recommendation engine: given a student's state and a pool of candidate
// questions, it scores every candidate and returns the best next questions.
//
// Each candidate's score combines three signals (weights configurable):
//   1. Topic weakness     -> weaker topics are prioritised        (1 - mastery)
//   2. Due for review     -> spaced-repetition items that are due get boosted
//   3. Difficulty match   -> questions slightly above the student's level score best
//
// A from-scratch max-heap (priority queue) selects the top-k, satisfying the
// "priority queue of due questions" requirement in the brief. Every recommended
// question also comes with a human-readable reason (explainability).

import { MaxHeap } from "./priorityQueue.js";
import { expectedScore } from "./elo.js";

export const DEFAULT_WEIGHTS = { weakness: 0.5, due: 0.3, difficulty: 0.2 };

// We want questions a little HARDER than the student so they are challenged but
// not overwhelmed. Target win-probability for the student ~ 0.6.
const TARGET_WIN_PROB = 0.6;

/**
 * @param {object} student  { rating:number, mastery: Map<topicId, number> }
 * @param {Array} candidates each: {
 *     questionId, topicId, questionRating,
 *     dueDate:number|null,      // ms timestamp, or null if never scheduled
 *     lastCorrect:boolean|null  // result of the most recent attempt, or null
 *   }
 * @param {object} opts { limit=5, now=Date.now(), weights }
 * @returns {Array<{questionId, topicId, score, reasons:string[]}>}
 */
export function recommend(student, candidates, opts = {}) {
  const limit = opts.limit ?? 5;
  const now = opts.now ?? Date.now();
  const weights = { ...DEFAULT_WEIGHTS, ...(opts.weights || {}) };

  const heap = new MaxHeap();
  for (const c of candidates) {
    const mastery = student.mastery.get(c.topicId) ?? 0.5;

    // 1. Topic weakness: 0..1, higher for weaker topics.
    const weakness = 1 - mastery;

    // 2. Due-for-review: 1 if overdue/now due, scaled down if it is in the
    //    future, 0.5 baseline for an unseen question (worth introducing).
    let due;
    if (c.dueDate == null) due = 0.5;
    else if (c.dueDate <= now) {
      const daysOverdue = (now - c.dueDate) / (24 * 3600 * 1000);
      due = Math.min(1, 0.8 + 0.04 * daysOverdue); // overdue items climb toward 1
    } else {
      const daysAway = (c.dueDate - now) / (24 * 3600 * 1000);
      due = Math.max(0, 0.5 - 0.05 * daysAway); // not due yet -> low
    }

    // 3. Difficulty match: students' expected win prob vs the question; best when
    //    close to TARGET_WIN_PROB.
    const winProb = expectedScore(student.rating, c.questionRating);
    const difficulty = 1 - Math.min(1, Math.abs(winProb - TARGET_WIN_PROB) / TARGET_WIN_PROB);

    const score =
      weights.weakness * weakness +
      weights.due * due +
      weights.difficulty * difficulty;

    const reasons = [];
    if (weakness >= 0.5) reasons.push(`weak topic (mastery ${Math.round(mastery * 100)}%)`);
    if (c.dueDate != null && c.dueDate <= now) reasons.push("due for review");
    if (c.dueDate == null) reasons.push("not attempted yet");
    if (difficulty >= 0.7) reasons.push("difficulty well matched");
    if (reasons.length === 0) reasons.push("balanced practice");

    heap.push({ questionId: c.questionId, topicId: c.topicId, score: round3(score), reasons }, score);
  }

  return heap.popMany(limit);
}

function round3(n) {
  return Math.round(n * 1000) / 1000;
}
