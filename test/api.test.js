// test/api.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";

import { Database } from "../src/db/database.js";
import { seed, QUESTIONS } from "../src/db/seed.js";
import { createServer } from "../src/server.js";

function freshDb() {
  const db = new Database(":memory:");
  const { studentId } = seed(db);
  return { db, studentId };
}

// ---- database layer ----
test("seed creates topics, questions and demo users", () => {
  const { db } = freshDb();
  assert.ok(db.getTopics().length >= 5);
  assert.ok(db.listQuestions().length >= 15);
  assert.ok(db.getUserByEmail("admin@example.com"));
});

test("objective attempt auto-marks correct and raises mastery", () => {
  const { db, studentId } = freshDb();
  const q = db.getQuestion(db.getCandidates(studentId).find((c) => c.type === "objective").questionId);
  const res = db.recordAttempt({ studentId, questionId: q.id, answer: q.answer });
  assert.equal(res.correct, true);
  assert.ok(res.mastery > 0.5);
});

test("wrong objective answer schedules review after 1 day", () => {
  const { db, studentId } = freshDb();
  const q = db.getQuestion(db.getCandidates(studentId).find((c) => c.type === "objective").questionId);
  const wrong = q.options.find((o) => o !== q.answer);
  const res = db.recordAttempt({ studentId, questionId: q.id, answer: wrong });
  assert.equal(res.correct, false);
  assert.equal(res.intervalDays, 1);
});

test("written question is self-marked against the mark scheme (feature 3)", () => {
  const { db, studentId } = freshDb();
  const written = db.listQuestions().find((q) => q.type === "written");
  const full = db.getQuestion(written.id);
  const res = db.recordAttempt({ studentId, questionId: full.id, answer: "my answer", awarded: full.marks });
  assert.equal(res.type, "written");
  assert.equal(res.correct, true);
  assert.equal(res.awardedMarks, full.marks);
  assert.ok(res.markScheme && res.markScheme.length > 0);
});

test("written self-mark is validated (feature 15)", () => {
  const { db, studentId } = freshDb();
  const written = db.getQuestion(db.listQuestions().find((q) => q.type === "written").id);
  assert.throws(() => db.recordAttempt({ studentId, questionId: written.id, answer: "x", awarded: written.marks + 5 }));
});

test("adding an objective question with answer not in options is rejected (feature 15)", () => {
  const { db } = freshDb();
  const topicId = db.getTopics()[0].id;
  assert.throws(() => db.addQuestion({ topicId, prompt: "Q", options: ["A", "B"], answer: "C" }));
});

// ---- HTTP API with auth ----
async function start() {
  const db = new Database(":memory:");
  seed(db);
  const server = createServer(db);
  server.listen(0);
  await once(server, "listening");
  return { server, base: `http://localhost:${server.address().port}` };
}
async function call(base, method, path, { token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const r = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, data: await r.json().catch(() => ({})) };
}
async function loginAs(base, email, password) {
  const { data } = await call(base, "POST", "/api/auth/login", { body: { email, password } });
  return data.token;
}

test("API: unauthenticated requests are rejected (feature 13)", async () => {
  const { server, base } = await start();
  try {
    const { status } = await call(base, "GET", "/api/recommendations");
    assert.equal(status, 401);
  } finally { server.close(); await once(server, "close"); }
});

test("API: login, recommend (no answers leaked), attempt, analytics", async () => {
  const { server, base } = await start();
  try {
    const token = await loginAs(base, "student@example.com", "student123");
    assert.ok(token);

    const me = (await call(base, "GET", "/api/auth/me", { token })).data.user;
    assert.equal(me.role, "student");

    const recs = (await call(base, "GET", "/api/recommendations?limit=3", { token })).data;
    assert.equal(recs.questions.length, 3);
    assert.ok(!("answer" in recs.questions[0]));
    assert.ok(!("markScheme" in recs.questions[0]));

    const first = recs.questions.find((q) => q.type === "objective");
    const attempt = (await call(base, "POST", "/api/attempts", { token, body: { questionId: first.questionId, answer: first.options[0] } })).data;
    assert.ok("correct" in attempt.result);

    const analytics = (await call(base, "GET", "/api/analytics", { token })).data;
    assert.ok(typeof analytics.overallReadiness === "number");
  } finally { server.close(); await once(server, "close"); }
});

test("API: a student cannot add questions but a teacher can (feature 14)", async () => {
  const { server, base } = await start();
  try {
    const studentTok = await loginAs(base, "student@example.com", "student123");
    const topicId = (await call(base, "GET", "/api/topics", { token: studentTok })).data.topics[0].id;
    const denied = await call(base, "POST", "/api/questions", { token: studentTok,
      body: { topicId, prompt: "Q", options: ["A", "B"], answer: "A" } });
    assert.equal(denied.status, 403);

    const teacherTok = await loginAs(base, "teacher@example.com", "teacher123");
    const ok = await call(base, "POST", "/api/questions", { token: teacherTok,
      body: { topicId, prompt: "New Q", options: ["A", "B"], answer: "A" } });
    assert.equal(ok.status, 201);
  } finally { server.close(); await once(server, "close"); }
});

test("API: only an admin can list and disable user accounts (feature 14)", async () => {
  const { server, base } = await start();
  try {
    const teacherTok = await loginAs(base, "teacher@example.com", "teacher123");
    assert.equal((await call(base, "GET", "/api/users", { token: teacherTok })).status, 403);

    const adminTok = await loginAs(base, "admin@example.com", "admin123");
    const users = (await call(base, "GET", "/api/users", { token: adminTok })).data.users;
    assert.ok(users.length >= 3);
    const student = users.find((u) => u.role === "student");
    const disabled = await call(base, "POST", `/api/users/${student.id}/disable`, { token: adminTok });
    assert.equal(disabled.status, 200);
    // disabled student can no longer log in
    const relogin = await call(base, "POST", "/api/auth/login", { body: { email: "student@example.com", password: "student123" } });
    assert.equal(relogin.status, 401);
  } finally { server.close(); await once(server, "close"); }
});

test("API: a student cannot read another student's analytics (ownership)", async () => {
  const { server, base } = await start();
  try {
    const adminTok = await loginAs(base, "admin@example.com", "admin123");
    const created = (await call(base, "POST", "/api/users", { token: adminTok,
      body: { name: "Other", email: "other@example.com", password: "other123", role: "student" } })).data.user;

    const studentTok = await loginAs(base, "student@example.com", "student123");
    const forbidden = await call(base, "GET", `/api/analytics?studentId=${created.id}`, { token: studentTok });
    assert.equal(forbidden.status, 403);
  } finally { server.close(); await once(server, "close"); }
});

test("API: wrong password is rejected", async () => {
  const { server, base } = await start();
  try {
    const { status } = await call(base, "POST", "/api/auth/login", { body: { email: "admin@example.com", password: "nope" } });
    assert.equal(status, 401);
  } finally { server.close(); await once(server, "close"); }
});

// ---- site theme ----
test("API: GET /api/theme is public and defaults to crimson", async () => {
  const { server, base } = await start();
  try {
    const { status, data } = await call(base, "GET", "/api/theme");
    assert.equal(status, 200);
    assert.equal(data.stored, "crimson");
    assert.equal(data.effective, "crimson");
    assert.equal(data.message, "");
  } finally { server.close(); await once(server, "close"); }
});

test("API: only an admin can change the site theme", async () => {
  const { server, base } = await start();
  try {
    const studentTok = await loginAs(base, "student@example.com", "student123");
    const denied = await call(base, "PUT", "/api/theme", { token: studentTok, body: { theme: "halloween" } });
    assert.equal(denied.status, 403);

    const teacherTok = await loginAs(base, "teacher@example.com", "teacher123");
    const deniedTeacher = await call(base, "PUT", "/api/theme", { token: teacherTok, body: { theme: "halloween" } });
    assert.equal(deniedTeacher.status, 403);

    const adminTok = await loginAs(base, "admin@example.com", "admin123");
    const ok = await call(base, "PUT", "/api/theme", { token: adminTok, body: { theme: "halloween" } });
    assert.equal(ok.status, 200);
    assert.equal(ok.data.stored, "halloween");
    assert.equal(ok.data.effective, "halloween");
    assert.ok(ok.data.message.length > 0);

    // persists for subsequent (public) reads
    const after = await call(base, "GET", "/api/theme");
    assert.equal(after.data.stored, "halloween");
  } finally { server.close(); await once(server, "close"); }
});

// ---- Stage 4: OCR past-paper retrieval on a wrong answer ----
test("API: a wrong answer on the stacks/queues question returns a real OCR excerpt and similar questions", async () => {
  const { server, base } = await start();
  try {
    const token = await loginAs(base, "student@example.com", "student123");
    const teacherTok = await loginAs(base, "teacher@example.com", "teacher123");
    const questions = (await call(base, "GET", "/api/questions", { token: teacherTok })).data.questions;
    const stacksVsQueues = questions.find((q) => q.topic === "Data Structures" && /stack/i.test(q.prompt) && q.type === "written");
    assert.ok(stacksVsQueues, "seed data should still contain the stacks-vs-queues written question");

    const attempt = await call(base, "POST", "/api/attempts", { token,
      body: { questionId: stacksVsQueues.id, answer: "I don't know", selfMarks: 0 } });
    assert.equal(attempt.status, 200);
    assert.equal(attempt.data.result.correct, false);
    assert.ok(attempt.data.result.relatedResource);
    assert.match(attempt.data.result.relatedResource.sourceUrl, /^https:\/\/www\.ocr\.org\.uk\//);
    assert.ok(Array.isArray(attempt.data.result.similarQuestions));
  } finally { server.close(); await once(server, "close"); }
});

test("API: similarQuestions never crosses into a different topic", async () => {
  // Regression: collaborative filtering is purely behavioural, so on sparse
  // attempt data it could otherwise suggest a completely unrelated topic.
  const { server, base } = await start();
  try {
    const token = await loginAs(base, "student@example.com", "student123");
    const teacherTok = await loginAs(base, "teacher@example.com", "teacher123");
    const questions = (await call(base, "GET", "/api/questions", { token: teacherTok })).data.questions;
    const networkQ = questions.find((q) => q.topic === "Networks" && q.type === "objective");
    const networkIds = new Set(questions.filter((q) => q.topic === "Networks").map((q) => q.id));

    const attempt = await call(base, "POST", "/api/attempts", { token,
      body: { questionId: networkQ.id, answer: "a deliberately wrong answer" } });
    assert.equal(attempt.data.result.correct, false);
    for (const qid of attempt.data.result.similarQuestions || []) {
      assert.ok(networkIds.has(qid), `question ${qid} is not in the Networks topic`);
    }
  } finally { server.close(); await once(server, "close"); }
});

test("API: a correct answer does not include relatedResource/similarQuestions", async () => {
  const { server, base } = await start();
  try {
    const token = await loginAs(base, "student@example.com", "student123");
    const recs = (await call(base, "GET", "/api/recommendations?limit=10", { token })).data;
    const objective = recs.questions.find((q) => q.type === "objective");
    const seedAnswer = QUESTIONS.find((q) => q.prompt === objective.prompt).answer;

    const attempt = await call(base, "POST", "/api/attempts", { token,
      body: { questionId: objective.questionId, answer: seedAnswer } });
    assert.equal(attempt.data.result.correct, true);
    assert.equal("relatedResource" in attempt.data.result, false);
    assert.equal("similarQuestions" in attempt.data.result, false);
  } finally { server.close(); await once(server, "close"); }
});

test("API: an unknown theme name is rejected", async () => {
  const { server, base } = await start();
  try {
    const adminTok = await loginAs(base, "admin@example.com", "admin123");
    const { status } = await call(base, "PUT", "/api/theme", { token: adminTok, body: { theme: "not-a-real-theme" } });
    assert.equal(status, 400);
  } finally { server.close(); await once(server, "close"); }
});
