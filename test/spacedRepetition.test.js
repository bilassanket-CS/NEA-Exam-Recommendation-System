// test/spacedRepetition.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { sm2, qualityFromAttempt, initialSchedule, MIN_EASINESS } from "../src/engine/spacedRepetition.js";

test("first correct review gives interval 1, second gives 6", () => {
  let s = initialSchedule();
  s = sm2(s, 5);
  assert.equal(s.repetitions, 1);
  assert.equal(s.interval, 1);
  s = sm2(s, 5);
  assert.equal(s.repetitions, 2);
  assert.equal(s.interval, 6);
});

test("third correct review multiplies interval by easiness", () => {
  let s = initialSchedule();
  s = sm2(s, 5); // interval 1
  s = sm2(s, 5); // interval 6
  const before = s.interval;
  s = sm2(s, 5); // interval = round(6 * EF)
  assert.equal(s.interval, Math.round(before * s.easiness));
  assert.ok(s.interval > before, "interval should grow");
});

test("a lapse (quality < 3) resets repetitions and interval to 1", () => {
  let s = initialSchedule();
  s = sm2(s, 5);
  s = sm2(s, 5); // now interval 6, reps 2
  s = sm2(s, 1); // wrong
  assert.equal(s.repetitions, 0);
  assert.equal(s.interval, 1);
});

test("easiness never drops below the minimum", () => {
  let s = initialSchedule();
  for (let i = 0; i < 10; i++) s = sm2(s, 0);
  assert.ok(s.easiness >= MIN_EASINESS, `easiness ${s.easiness} >= ${MIN_EASINESS}`);
});

test("invalid quality throws", () => {
  assert.throws(() => sm2(initialSchedule(), 6), RangeError);
  assert.throws(() => sm2(initialSchedule(), -1), RangeError);
});

test("qualityFromAttempt maps outcomes correctly", () => {
  assert.equal(qualityFromAttempt({ correct: true, fast: true }), 5);
  assert.equal(qualityFromAttempt({ correct: true }), 4);
  assert.equal(qualityFromAttempt({ correct: false }), 2);
  assert.equal(qualityFromAttempt({ correct: false, blank: true }), 0);
});
