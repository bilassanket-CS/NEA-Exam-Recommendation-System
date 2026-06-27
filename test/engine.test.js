// test/engine.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { expectedScore, updateRatings } from "../src/engine/elo.js";
import { updateMastery, weakestTopics, readiness } from "../src/engine/mastery.js";
import { MaxHeap } from "../src/engine/priorityQueue.js";
import { recommend } from "../src/engine/recommender.js";
import { cosineSimilarity, collaborativeRecommend } from "../src/engine/collaborative.js";

// ---- Elo ----
test("equal ratings give 0.5 expected score", () => {
  assert.equal(expectedScore(1200, 1200), 0.5);
});

test("correct answer raises student and lowers question rating", () => {
  const { studentRating, questionRating } = updateRatings(1200, 1200, true);
  assert.ok(studentRating > 1200);
  assert.ok(questionRating < 1200);
});

test("wrong answer lowers student and raises question rating", () => {
  const { studentRating, questionRating } = updateRatings(1200, 1200, false);
  assert.ok(studentRating < 1200);
  assert.ok(questionRating > 1200);
});

// ---- mastery ----
test("mastery moves toward 1 on correct and 0 on wrong, staying in range", () => {
  let m = 0.5;
  m = updateMastery(m, true);
  assert.ok(m > 0.5 && m <= 1);
  let w = 0.5;
  for (let i = 0; i < 20; i++) w = updateMastery(w, false);
  assert.ok(w >= 0 && w < 0.05);
});

test("weakestTopics sorts ascending by mastery", () => {
  const topics = [
    { topicId: 1, mastery: 0.9 },
    { topicId: 2, mastery: 0.2 },
    { topicId: 3, mastery: 0.5 },
  ];
  const weak = weakestTopics(topics, 2);
  assert.deepEqual(weak.map((t) => t.topicId), [2, 3]);
});

test("readiness is the average mastery as a percentage", () => {
  assert.equal(readiness([{ mastery: 0.5 }, { mastery: 0.5 }]), 50);
  assert.equal(readiness([]), 0);
});

// ---- priority queue ----
test("MaxHeap returns items in descending priority", () => {
  const h = new MaxHeap();
  [3, 1, 7, 4, 9, 2].forEach((p) => h.push(`v${p}`, p));
  assert.deepEqual(h.popMany(3), ["v9", "v7", "v4"]);
  assert.equal(h.size, 3);
});

// ---- recommender ----
test("weaker topics are recommended ahead of stronger ones, all else equal", () => {
  const student = { rating: 1200, mastery: new Map([[1, 0.1], [2, 0.9]]) };
  const candidates = [
    { questionId: 10, topicId: 2, questionRating: 1200, dueDate: null, lastCorrect: null }, // strong topic
    { questionId: 11, topicId: 1, questionRating: 1200, dueDate: null, lastCorrect: null }, // weak topic
  ];
  const ranked = recommend(student, candidates, { limit: 2, now: 0 });
  assert.equal(ranked[0].questionId, 11, "weak-topic question should rank first");
});

test("a due (overdue) review outranks a not-yet-due question in the same topic", () => {
  const now = 1_000_000_000_000;
  const student = { rating: 1200, mastery: new Map([[1, 0.5]]) };
  const candidates = [
    { questionId: 20, topicId: 1, questionRating: 1200, dueDate: now - 3 * 86400000, lastCorrect: false }, // overdue
    { questionId: 21, topicId: 1, questionRating: 1200, dueDate: now + 5 * 86400000, lastCorrect: true },  // future
  ];
  const ranked = recommend(student, candidates, { limit: 2, now });
  assert.equal(ranked[0].questionId, 20);
});

test("recommend returns at most `limit` items and attaches reasons", () => {
  const student = { rating: 1200, mastery: new Map() };
  const candidates = Array.from({ length: 10 }, (_, i) => ({
    questionId: i, topicId: 1, questionRating: 1200, dueDate: null, lastCorrect: null,
  }));
  const ranked = recommend(student, candidates, { limit: 3, now: 0 });
  assert.equal(ranked.length, 3);
  assert.ok(Array.isArray(ranked[0].reasons) && ranked[0].reasons.length > 0);
});

// ---- collaborative filtering ----
test("cosineSimilarity basics", () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [0, 1]), 0);
  assert.equal(cosineSimilarity([0, 0], [1, 1]), 0);
});

test("collaborativeRecommend suggests unseen questions linked to wrong ones", () => {
  // Students 1 & 2 behave alike; student 1 is the target.
  const students = [1, 2, 3];
  const questions = [100, 101, 102];
  const outcomes = new Map([
    ["1:100", 0], ["1:101", 1],          // target: wrong on 100, right on 101, hasn't seen 102
    ["2:100", 0], ["2:102", 0],          // similar student also wrong on 100 and 102
    ["3:100", 1], ["3:102", 1],          // dissimilar student
  ]);
  const recs = collaborativeRecommend({ students, questions, outcomes, targetStudent: 1 }, 5);
  const ids = recs.map((r) => r.questionId);
  assert.ok(ids.includes(102), "should recommend 102");
  assert.ok(!ids.includes(101), "should not recommend already-attempted 101");
});
