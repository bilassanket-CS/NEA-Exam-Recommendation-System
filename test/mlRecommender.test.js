// test/mlRecommender.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { Database } from "../src/db/database.js";
import { seed } from "../src/db/seed.js";
import {
  trainLogisticRegression, predict, replayTrainingData, getOrTrainModel, MIN_TRAINING_ATTEMPTS,
} from "../src/engine/mlRecommender.js";
import { recommend, recommendML } from "../src/engine/recommender.js";

function freshDb() {
  const db = new Database(":memory:");
  const { studentId } = seed(db);
  return { db, studentId };
}

// ---- trainLogisticRegression / predict ----
test("gradient descent separates a simple linearly-separable dataset", () => {
  // label = 1 whenever feature[0] > 0.5, independent of the other two features.
  const pairs = [];
  for (let i = 0; i < 40; i++) {
    const x0 = i % 2 === 0 ? 0.9 : 0.1;
    pairs.push({ features: [x0, 0.5, 0.5], label: x0 > 0.5 ? 1 : 0 });
  }
  const { weights, bias } = trainLogisticRegression(pairs, { epochs: 500, learningRate: 0.5 });
  assert.equal(predict(weights, bias, [0.9, 0.5, 0.5]) > 0.5, true);
  assert.equal(predict(weights, bias, [0.1, 0.5, 0.5]) < 0.5, true);
});

test("an empty training set returns a harmless zero model", () => {
  const { weights, bias } = trainLogisticRegression([]);
  assert.deepEqual(weights, []);
  assert.equal(bias, 0);
});

// ---- replayTrainingData: no leakage from the future ----
test("the first attempt by a student reflects pure cold-start feature values", () => {
  const { db, studentId } = freshDb();
  const q = db.listQuestions().find((x) => x.type === "objective");
  db.recordAttempt({ studentId, questionId: q.id, answer: "whatever-is-wrong-on-purpose" });

  const pairs = replayTrainingData(db);
  assert.equal(pairs.length, 1);
  const [weakness, due, winProb, subTopicSim, marksNorm, cfSim] = pairs[0].features;
  assert.equal(weakness, 0.5);   // mastery defaults to 0.5 before any attempt
  assert.equal(due, 0.5);        // never scheduled yet
  assert.equal(winProb, 0.5);    // both ratings start at 1200
  assert.equal(subTopicSim, 0);  // no prior wrong questions to compare against
  assert.ok(marksNorm > 0 && marksNorm <= 1);
  assert.equal(cfSim, 0);        // no prior wrong questions to seed collaborative similarity
});

test("replayTrainingData produces exactly one training pair per attempt", () => {
  const { db, studentId } = freshDb();
  const questions = db.listQuestions().filter((x) => x.type === "objective").slice(0, 3);
  for (const q of questions) {
    const full = db.getQuestion(q.id);
    db.recordAttempt({ studentId, questionId: q.id, answer: full.answer });
  }
  assert.equal(replayTrainingData(db).length, 3);
});

// ---- getOrTrainModel: cold start vs trained ----
test("getOrTrainModel returns null (cold start) below the training threshold", () => {
  const { db, studentId } = freshDb();
  const q = db.listQuestions().find((x) => x.type === "objective");
  const full = db.getQuestion(q.id);
  db.recordAttempt({ studentId, questionId: q.id, answer: full.answer }); // 1 attempt, far below threshold
  assert.equal(getOrTrainModel(db), null);
});

test("getOrTrainModel trains and caches once enough attempts exist", () => {
  const { db, studentId } = freshDb();
  const objective = db.listQuestions().filter((x) => x.type === "objective");
  for (let i = 0; i < MIN_TRAINING_ATTEMPTS; i++) {
    const q = objective[i % objective.length];
    const full = db.getQuestion(q.id);
    const answer = i % 3 === 0 ? "deliberately wrong" : full.answer;
    db.recordAttempt({ studentId, questionId: q.id, answer });
  }
  const model = getOrTrainModel(db);
  assert.ok(model);
  assert.equal(model.weights.length, 6);
  assert.equal(model.trainedAtAttemptCount, MIN_TRAINING_ATTEMPTS);

  // cached: a second call with no new attempts returns the same trained-at count
  const again = getOrTrainModel(db);
  assert.equal(again.trainedAtAttemptCount, MIN_TRAINING_ATTEMPTS);
});

// ---- recommendML: cold-start parity with Stage 1, then genuinely differs once trained ----
test("recommendML falls back to the Stage-1 heuristic during cold start", () => {
  const { db, studentId } = freshDb();
  const student = { id: studentId, rating: 1200, mastery: db.getMasteryMap(studentId) };
  const candidates = db.getCandidates(studentId);

  const stage1 = recommend(student, candidates, { limit: 5, now: Date.now() });
  const ml = recommendML(db, student, candidates, { limit: 5, now: Date.now() });
  assert.deepEqual(ml.map((r) => r.questionId), stage1.map((r) => r.questionId));
});

test("recommendML returns a full ranked list once a model is trained", () => {
  const { db, studentId } = freshDb();
  const objective = db.listQuestions().filter((x) => x.type === "objective");
  for (let i = 0; i < MIN_TRAINING_ATTEMPTS; i++) {
    const q = objective[i % objective.length];
    const full = db.getQuestion(q.id);
    const answer = i % 3 === 0 ? "deliberately wrong" : full.answer;
    db.recordAttempt({ studentId, questionId: q.id, answer });
  }
  const student = { id: studentId, rating: db.getStudent(studentId).rating, mastery: db.getMasteryMap(studentId) };
  const ranked = recommendML(db, student, db.getCandidates(studentId), { limit: 5, now: Date.now() });
  assert.equal(ranked.length, 5);
  for (const r of ranked) {
    assert.ok(r.reasons.length > 0);
    assert.ok(typeof r.score === "number");
  }
});
