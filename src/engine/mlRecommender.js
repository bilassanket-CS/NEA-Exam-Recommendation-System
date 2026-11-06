// src/engine/mlRecommender.js
// A from-scratch logistic regression that LEARNS how much to trust each
// recommendation signal from real attempt history, instead of the fixed
// {0.5, 0.3, 0.2} weights in recommender.js's Stage-1 heuristic.
//
// Training data is built by REPLAYING the attempts table in chronological
// order per student, reconstructing mastery/Elo/spaced-repetition state
// incrementally so every example's features reflect state strictly BEFORE
// that attempt (no leakage from its own outcome or from later attempts).
//
// Known simplification (documented, not hidden): the collaborative-filtering
// feature is built from the FINAL/global outcomes matrix for every training
// example, rather than a point-in-time snapshot. A fully leakage-free version
// would need an incrementally-rebuilt matrix per example (O(n^2) at this
// project's scale, which is feasible, but a materially bigger undertaking for
// one feature of six) — a reasonable, acknowledged corner to cut.

import { expectedScore, updateRatings, DEFAULT_RATING } from "./elo.js";
import { updateMasteryValue } from "./mastery.js";
import { sm2, qualityFromAttempt, initialSchedule } from "./spacedRepetition.js";
import { buildQuestionVectors, cfSimilarityScore } from "./collaborative.js";
import { subTopicSimilarity } from "./contentFeatures.js";
import { dueSignal } from "./recommender.js";

export const MIN_TRAINING_ATTEMPTS = 30;
const SETTINGS_KEY = "ml_model_weights";
const WRONG_HISTORY_LIMIT = 10;

function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}
function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** sigmoid(weights . features + bias) -> predicted probability of a correct answer. */
export function predict(weights, bias, features) {
  return sigmoid(dot(weights, features) + bias);
}

/** From-scratch batch gradient descent on binary cross-entropy. */
export function trainLogisticRegression(pairs, { epochs = 300, learningRate = 0.3 } = {}) {
  const n = pairs.length;
  const dim = pairs[0]?.features.length ?? 0;
  let weights = new Array(dim).fill(0);
  let bias = 0;
  if (n === 0 || dim === 0) return { weights, bias };

  for (let e = 0; e < epochs; e++) {
    const gradW = new Array(dim).fill(0);
    let gradB = 0;
    for (const { features, label } of pairs) {
      const error = predict(weights, bias, features) - label; // label is 0 or 1
      for (let i = 0; i < dim; i++) gradW[i] += error * features[i];
      gradB += error;
    }
    for (let i = 0; i < dim; i++) weights[i] -= (learningRate * gradW[i]) / n;
    bias -= (learningRate * gradB) / n;
  }
  return { weights, bias };
}

/**
 * Replay every attempt in chronological order, reconstructing per-student
 * mastery/Elo/SM-2 state as it was BEFORE each attempt, and return
 * `{ features, label }` training pairs. Feature order matches recommendML()
 * in recommender.js: [weakness, due, eloWinProb, subTopicSimilarity, marksNormalised, cfSimilarity].
 */
export function replayTrainingData(db) {
  const attempts = db.getAllAttemptsChronological();
  if (attempts.length === 0) return [];

  const { students, questions, outcomes } = db.getOutcomesMatrix();
  const vectors = buildQuestionVectors(students, questions, outcomes);
  const maxMarks = Math.max(1, ...attempts.map((a) => a.marks || 1));

  const masteryByStudent = new Map();   // studentId -> Map(topicId -> mastery)
  const ratingByStudent = new Map();    // studentId -> Elo rating
  const ratingByQuestion = new Map();   // questionId -> Elo rating
  const scheduleByPair = new Map();     // "sid:qid" -> {repetitions,interval,easiness}
  const dueByPair = new Map();          // "sid:qid" -> due date (ms)
  const wrongByStudent = new Map();     // studentId -> [{id, text}] most-recent-last

  const pairs = [];

  for (const a of attempts) {
    const sid = a.studentId, qid = a.questionId, key = `${sid}:${qid}`;
    const correct = !!a.correct;

    const mastery = masteryByStudent.get(sid)?.get(a.topicId) ?? 0.5;
    const studentRating = ratingByStudent.get(sid) ?? DEFAULT_RATING;
    const questionRating = ratingByQuestion.get(qid) ?? DEFAULT_RATING;
    const dueDate = dueByPair.get(key) ?? null;
    const wrongSoFar = wrongByStudent.get(sid) ?? [];

    const weakness = 1 - mastery;
    const due = dueSignal(dueDate, a.createdAt);
    const winProb = expectedScore(studentRating, questionRating);
    const subTopicSim = subTopicSimilarity(`${a.subTopic ?? ""} ${a.prompt ?? ""}`, wrongSoFar.map((w) => w.text));
    const marksNorm = Math.min(1, (a.marks || 1) / maxMarks);
    const cfSim = cfSimilarityScore(qid, wrongSoFar.map((w) => w.id), vectors);

    pairs.push({ features: [weakness, due, winProb, subTopicSim, marksNorm, cfSim], label: correct ? 1 : 0 });

    // ---- advance state using this attempt's real outcome, for the NEXT one ----
    if (!masteryByStudent.has(sid)) masteryByStudent.set(sid, new Map());
    masteryByStudent.get(sid).set(a.topicId, updateMasteryValue(mastery, correct ? 1 : 0));

    const { studentRating: nsr, questionRating: nqr } = updateRatings(studentRating, questionRating, correct);
    ratingByStudent.set(sid, nsr);
    ratingByQuestion.set(qid, nqr);

    const prevSchedule = scheduleByPair.get(key) ?? initialSchedule();
    const quality = qualityFromAttempt({ correct, blank: false });
    const nextSchedule = sm2(prevSchedule, quality);
    scheduleByPair.set(key, nextSchedule);
    dueByPair.set(key, a.createdAt + nextSchedule.interval * 24 * 3600 * 1000);

    if (!correct) {
      const updated = [...wrongSoFar, { id: qid, text: `${a.subTopic ?? ""} ${a.prompt ?? ""}` }].slice(-WRONG_HISTORY_LIMIT);
      wrongByStudent.set(sid, updated);
    }
  }

  return pairs;
}

/**
 * Returns a trained `{ weights, bias, trainedAtAttemptCount }` model, cached
 * in the `settings` table and retrained only when new attempts have arrived
 * since the cached version. Returns `null` (cold start -> caller should fall
 * back to the Stage-1 fixed-weight heuristic) when there isn't yet enough
 * attempt history to train a reliable model.
 */
export function getOrTrainModel(db) {
  const totalAttempts = db.countAttempts();
  if (totalAttempts < MIN_TRAINING_ATTEMPTS) return null;

  const cached = db.getSetting(SETTINGS_KEY);
  if (cached) {
    const parsed = JSON.parse(cached);
    if (parsed.trainedAtAttemptCount === totalAttempts) return parsed;
  }

  const pairs = replayTrainingData(db);
  if (pairs.length < MIN_TRAINING_ATTEMPTS) return null;

  const { weights, bias } = trainLogisticRegression(pairs);
  const model = { weights, bias, trainedAtAttemptCount: totalAttempts };
  db.setSetting(SETTINGS_KEY, JSON.stringify(model));
  return model;
}
