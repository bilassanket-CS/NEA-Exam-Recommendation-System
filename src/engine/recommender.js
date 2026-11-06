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
import { buildQuestionVectors, cfSimilarityScore } from "./collaborative.js";
import { subTopicSimilarity } from "./contentFeatures.js";
import { getOrTrainModel, predict } from "./mlRecommender.js";

export const DEFAULT_WEIGHTS = { weakness: 0.5, due: 0.3, difficulty: 0.2 };

// We want questions a little HARDER than the student so they are challenged but
// not overwhelmed. Target win-probability for the student ~ 0.6.
const TARGET_WIN_PROB = 0.6;

/**
 * The "due for review" signal: 1 if overdue/now due, scaled down if it is in
 * the future, 0.5 baseline for an unseen question (worth introducing).
 * Shared between the Stage-1 heuristic (below) and Stage 2's ML feature
 * builder/training replay, so the definition of "due" never drifts apart.
 */
export function dueSignal(dueDate, now) {
  if (dueDate == null) return 0.5;
  if (dueDate <= now) {
    const daysOverdue = (now - dueDate) / (24 * 3600 * 1000);
    return Math.min(1, 0.8 + 0.04 * daysOverdue);
  }
  const daysAway = (dueDate - now) / (24 * 3600 * 1000);
  return Math.max(0, 0.5 - 0.05 * daysAway);
}

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

    // 2. Due-for-review (see dueSignal() above).
    const due = dueSignal(c.dueDate, now);

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

/**
 * Stage 2+3: content-based features (topic weakness, due-ness, sub-topic text
 * similarity to recently-missed questions, question marks) PLUS a Stage-3
 * collaborative-filtering similarity feature, scored by a hand-rolled logistic
 * regression trained on real attempt history (see mlRecommender.js) instead of
 * the fixed weights above. Falls back to the plain Stage-1 `recommend()` while
 * there isn't yet enough attempt history to train reliably (cold start).
 *
 * @param {import("../db/database.js").Database} db
 * @param {object} student { id, rating, mastery: Map<topicId, number> }
 * @param {Array} candidates same shape as recommend(), plus { subTopic, prompt, marks }
 * @param {object} opts { limit=5, now=Date.now() }
 */
export function recommendML(db, student, candidates, opts = {}) {
  const limit = opts.limit ?? 5;
  const now = opts.now ?? Date.now();

  const model = getOrTrainModel(db);
  if (!model) return recommend(student, candidates, opts);

  const wrongQuestions = db.getRecentWrongQuestions(student.id, 10);
  const wrongTexts = wrongQuestions.map((q) => `${q.subTopic ?? ""} ${q.prompt ?? ""}`);
  const wrongIds = wrongQuestions.map((q) => q.id);
  const { students, questions, outcomes } = db.getOutcomesMatrix();
  const vectors = buildQuestionVectors(students, questions, outcomes);
  const maxMarks = Math.max(1, ...candidates.map((c) => c.marks ?? 1));

  const heap = new MaxHeap();
  for (const c of candidates) {
    const mastery = student.mastery.get(c.topicId) ?? 0.5;
    const weakness = 1 - mastery;
    const due = dueSignal(c.dueDate, now);
    const winProb = expectedScore(student.rating, c.questionRating);
    const subTopicSim = subTopicSimilarity(`${c.subTopic ?? ""} ${c.prompt ?? ""}`, wrongTexts);
    const marksNorm = Math.min(1, (c.marks ?? 1) / maxMarks);
    const cfSim = cfSimilarityScore(c.questionId, wrongIds, vectors);

    const predictedP = predict(model.weights, model.bias, [weakness, due, winProb, subTopicSim, marksNorm, cfSim]);
    const difficulty = 1 - Math.min(1, Math.abs(predictedP - TARGET_WIN_PROB) / TARGET_WIN_PROB);

    const score =
      DEFAULT_WEIGHTS.weakness * weakness +
      DEFAULT_WEIGHTS.due * due +
      DEFAULT_WEIGHTS.difficulty * difficulty;

    const reasons = [];
    if (weakness >= 0.5) reasons.push(`weak topic (mastery ${Math.round(mastery * 100)}%)`);
    if (c.dueDate != null && c.dueDate <= now) reasons.push("due for review");
    if (c.dueDate == null) reasons.push("not attempted yet");
    if (cfSim >= 0.4) reasons.push("students with a similar performance profile also found this useful");
    if (subTopicSim >= 0.4) reasons.push("similar to a question you recently got wrong");
    if (difficulty >= 0.7) reasons.push("difficulty well matched (model-predicted)");
    if (reasons.length === 0) reasons.push("balanced practice");

    heap.push({ questionId: c.questionId, topicId: c.topicId, score: round3(score), reasons }, score);
  }

  return heap.popMany(limit);
}
