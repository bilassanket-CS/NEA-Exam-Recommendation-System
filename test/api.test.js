// test/api.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { Database } from "../src/db/database.js";
import { seed } from "../src/db/seed.js";
import { createServer } from "../src/server.js";

function freshDb() {
  const db = new Database(":memory:");
  const { studentId } = seed(db);
  return { db, studentId };
}

// ---- database layer ----
test("seed creates topics and questions", () => {
  const { db } = freshDb();
  assert.ok(db.getTopics().length >= 5);
});

test("recordAttempt auto-marks a correct answer and updates mastery upward", () => {
  const { db, studentId } = freshDb();
  // find a question and answer it correctly
  const cand = db.getCandidates(studentId)[0];
  const q = db.getQuestion(cand.questionId);
  const res = db.recordAttempt({ studentId, questionId: q.id, answer: q.answer });
  assert.equal(res.correct, true);
  assert.ok(res.mastery > 0.5, "mastery should rise after a correct answer");
  assert.ok(res.intervalDays >= 1);
});

test("recordAttempt marks a wrong answer and schedules a near-term review", () => {
  const { db, studentId } = freshDb();
  const cand = db.getCandidates(studentId)[0];
  const q = db.getQuestion(cand.questionId);
  const wrong = q.options.find((o) => o !== q.answer);
  const res = db.recordAttempt({ studentId, questionId: q.id, answer: wrong });
  assert.equal(res.correct, false);
  assert.equal(res.intervalDays, 1, "a lapse reviews again after 1 day");
});

test("a blank answer is handled (not counted correct)", () => {
  const { db, studentId } = freshDb();
  const q = db.getQuestion(db.getCandidates(studentId)[0].questionId);
  const res = db.recordAttempt({ studentId, questionId: q.id, answer: "" });
  assert.equal(res.correct, false);
  assert.equal(res.blank, true);
});

test("analytics aggregates per-topic mastery and accuracy", () => {
  const { db, studentId } = freshDb();
  // answer two questions in the same topic, one right one wrong
  const cands = db.getCandidates(studentId);
  const topicId = cands[0].topicId;
  const sameTopic = cands.filter((c) => c.topicId === topicId).slice(0, 2);
  const q0 = db.getQuestion(sameTopic[0].questionId);
  db.recordAttempt({ studentId, questionId: q0.id, answer: q0.answer }); // correct
  if (sameTopic[1]) {
    const q1 = db.getQuestion(sameTopic[1].questionId);
    const wrong = q1.options.find((o) => o !== q1.answer);
    db.recordAttempt({ studentId, questionId: q1.id, answer: wrong }); // wrong
  }
  const rows = db.getAnalytics(studentId);
  const row = rows.find((r) => r.topicId === topicId);
  assert.ok(row.attempts >= 1);
  assert.ok(row.accuracy >= 0 && row.accuracy <= 100);
});

// ---- HTTP API ----
async function startServer() {
  const db = new Database(":memory:");
  seed(db);
  const server = createServer(db);
  server.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  return { server, base: `http://localhost:${port}` };
}

test("API: health, recommendations, attempt and analytics flow", async () => {
  const { server, base } = await startServer();
  try {
    const health = await (await fetch(`${base}/api/health`)).json();
    assert.equal(health.ok, true);

    const { student } = await (await fetch(`${base}/api/students`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Tester" }),
    })).json();
    assert.ok(student.id);

    const recs = await (await fetch(`${base}/api/recommendations?studentId=${student.id}&limit=3`)).json();
    assert.equal(recs.questions.length, 3);
    // answers must NOT be exposed in recommendations
    assert.ok(!("answer" in recs.questions[0]));

    const first = recs.questions[0];
    const attempt = await (await fetch(`${base}/api/attempts`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: student.id, questionId: first.questionId, answer: first.options[0] }),
    })).json();
    assert.ok("correct" in attempt.result);

    const analytics = await (await fetch(`${base}/api/analytics?studentId=${student.id}`)).json();
    assert.ok(Array.isArray(analytics.topics));
    assert.ok(typeof analytics.overallReadiness === "number");
  } finally {
    server.close();
    await once(server, "close");
  }
});

test("API: unknown student returns 404", async () => {
  const { server, base } = await startServer();
  try {
    const r = await fetch(`${base}/api/recommendations?studentId=99999`);
    assert.equal(r.status, 404);
  } finally {
    server.close();
    await once(server, "close");
  }
});
