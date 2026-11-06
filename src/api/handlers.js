// src/api/handlers.js
// Request handlers. Each receives the Database, the parsed input and (where
// relevant) the authenticated user, and returns a plain object. Authorisation
// rules (ownership and roles) are enforced here and in the server.

import { recommendML } from "../engine/recommender.js";
import { readiness } from "../engine/mastery.js";
import { STORABLE_THEMES, effectiveTheme, seasonalMessage } from "../engine/theme.js";
import { collaborativeRecommend } from "../engine/collaborative.js";
import { findRelatedResource } from "../engine/retrieval.js";

const err = (msg, status) => { const e = new Error(msg); e.status = status; return e; };
const isStaff = (user) => user && (user.role === "teacher" || user.role === "admin");

/** A student may only act on their own data; staff may act on anyone. */
function assertCanAccessStudent(user, studentId) {
  if (!user) throw err("authentication required", 401);
  if (isStaff(user)) return;
  if (Number(studentId) !== Number(user.id)) throw err("forbidden", 403);
}

// ---- auth ----
export function register(db, { name, email, password }) {
  if (!email || !password) throw err("email and password are required", 400);
  const id = db.addUser({ name: name || email, email, password, role: "student" });
  const token = db.createSession(id);
  return { token, user: db.getUserById(id) };
}
export function login(db, { email, password }) {
  const user = db.authenticate(email, password);
  if (!user) throw err("invalid email or password", 401);
  const token = db.createSession(user.id);
  return { token, user };
}
export function me(db, user) {
  if (!user) throw err("authentication required", 401);
  return { user };
}

// ---- practice / recommendations ----
export function getRecommendations(db, { studentId, limit = 5, now = Date.now() }, user) {
  assertCanAccessStudent(user, studentId);
  if (!db.getUserById(studentId)) throw err("student not found", 404);
  const student = db.getStudent(studentId);
  const ranked = recommendML(
    db,
    { id: studentId, rating: student.rating, mastery: db.getMasteryMap(studentId) },
    db.getCandidates(studentId), { limit, now }
  );
  const questions = ranked.map((r) => {
    const q = db.getQuestion(r.questionId);
    const base = { questionId: q.id, topicId: q.topic_id, subTopic: q.sub_topic,
      type: q.type, prompt: q.prompt, marks: q.marks, score: r.score, reasons: r.reasons };
    if (q.type === "objective") base.options = q.options;   // never the answer
    return base;                                            // mark scheme withheld until submit
  });
  return { studentId, count: questions.length, questions };
}

export function submitAttempt(db, { studentId, questionId, answer, selfMarks, now = Date.now() }, user) {
  if (studentId == null || questionId == null) throw err("studentId and questionId are required", 400);
  assertCanAccessStudent(user, studentId);
  if (!db.getUserById(studentId)) throw err("student not found", 404);
  const question = db.getQuestion(questionId);
  if (!question) throw err("question not found", 404);
  const result = db.recordAttempt({ studentId, questionId, answer, awarded: selfMarks, now });

  // Stage 4: on a wrong answer, surface a real OCR mark-scheme excerpt and a
  // few similar questions (Stage 3's collaborative filtering, seeded by this
  // very attempt among the student's other wrong answers).
  if (!result.correct) {
    const topic = db.getTopicById(question.topic_id);
    if (topic) {
      const queryText = `${question.sub_topic ?? ""} ${question.prompt ?? ""}`;
      const relatedResource = findRelatedResource(topic.name, queryText);
      if (relatedResource) result.relatedResource = relatedResource;
    }
    const { students, questions, outcomes } = db.getOutcomesMatrix();
    const similar = collaborativeRecommend({ students, questions, outcomes, targetStudent: studentId }, 3);
    if (similar.length) result.similarQuestions = similar.map((s) => s.questionId);
  }

  return { result };
}

export function getAnalytics(db, { studentId, now = Date.now() }, user) {
  assertCanAccessStudent(user, studentId);
  const student = db.getStudent(studentId);
  if (!student) throw err("student not found", 404);
  const topics = db.getAnalytics(studentId);
  return {
    student, overallReadiness: readiness(topics.map((t) => ({ mastery: t.mastery }))),
    dueCount: db.getDueCount(studentId, now), topics,
  };
}

// ---- content management (teacher/admin) ----
export function addQuestion(db, body, user) {
  if (!isStaff(user)) throw err("forbidden", 403);
  const id = db.addQuestion(body);
  return { questionId: id };
}
export function updateQuestion(db, id, body, user) {
  if (!isStaff(user)) throw err("forbidden", 403);
  return { question: db.updateQuestion(id, body) };
}
export function listQuestions(db, user) {
  if (!isStaff(user)) throw err("forbidden", 403);
  return { questions: db.listQuestions() };
}
export function getTopics(db) { return { topics: db.getTopics() }; }

/** A single question's safe practice payload (never the answer/mark scheme) —
 *  used by the "try a similar question" shortcut after a wrong answer. */
export function getQuestionForPractice(db, id, user) {
  if (!user) throw err("authentication required", 401);
  const q = db.getQuestion(id);
  if (!q) throw err("question not found", 404);
  const base = { questionId: q.id, topicId: q.topic_id, subTopic: q.sub_topic, type: q.type, prompt: q.prompt, marks: q.marks };
  if (q.type === "objective") base.options = q.options; // never the answer
  return base;
}

// ---- account management (admin) ----
export function listUsers(db, user) {
  if (!user || user.role !== "admin") throw err("forbidden", 403);
  return { users: db.listUsers() };
}
export function createUser(db, body, user) {
  if (!user || user.role !== "admin") throw err("forbidden", 403);
  const id = db.addUser(body);
  return { user: db.getUserById(id) };
}
export function setUserActive(db, id, active, user) {
  if (!user || user.role !== "admin") throw err("forbidden", 403);
  db.setUserActive(id, active);
  return { user: db.getUserById(id) };
}

// ---- site theme ----
export function getTheme(db) {
  const stored = db.getSetting("theme") || "crimson";
  const effective = effectiveTheme(stored);
  return { stored, effective, message: seasonalMessage(effective) };
}
export function setTheme(db, { theme }, user) {
  if (!user || user.role !== "admin") throw err("forbidden", 403);
  if (!Object.prototype.hasOwnProperty.call(STORABLE_THEMES, theme)) throw err("unknown theme", 400);
  db.setSetting("theme", theme);
  return getTheme(db);
}
