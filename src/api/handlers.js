// src/api/handlers.js
// Pure-ish request handlers: each takes parsed input and the Database, returns
// a plain object (the server serialises it to JSON). Kept separate from the HTTP
// plumbing so they are easy to unit-test.

import { recommend } from "../engine/recommender.js";
import { readiness } from "../engine/mastery.js";

export function getTopics(db) {
  return { topics: db.getTopics() };
}

export function createStudent(db, { name }) {
  if (!name || !String(name).trim()) {
    const e = new Error("name is required");
    e.status = 400;
    throw e;
  }
  const id = db.addStudent(String(name).trim());
  return { student: db.getStudent(id) };
}

export function getStudent(db, studentId) {
  const student = db.getStudent(studentId);
  if (!student) {
    const e = new Error("student not found");
    e.status = 404;
    throw e;
  }
  return { student };
}

/** Recommend next questions. Answers are NOT included in the response. */
export function getRecommendations(db, { studentId, limit = 5, now = Date.now() }) {
  const student = db.getStudent(studentId);
  if (!student) {
    const e = new Error("student not found");
    e.status = 404;
    throw e;
  }
  const candidates = db.getCandidates(studentId);
  const masteryMap = db.getMasteryMap(studentId);
  const ranked = recommend({ rating: student.rating, mastery: masteryMap }, candidates, { limit, now });

  const questions = ranked.map((r) => {
    const q = db.getQuestion(r.questionId);
    return {
      questionId: q.id,
      topicId: q.topic_id,
      prompt: q.prompt,
      options: q.options,
      marks: q.marks,
      score: r.score,
      reasons: r.reasons,
    };
  });
  return { studentId, count: questions.length, questions };
}

/** Submit an answer; auto-mark and update all models. */
export function submitAttempt(db, { studentId, questionId, answer, now = Date.now() }) {
  if (studentId == null || questionId == null) {
    const e = new Error("studentId and questionId are required");
    e.status = 400;
    throw e;
  }
  if (!db.getStudent(studentId)) {
    const e = new Error("student not found"); e.status = 404; throw e;
  }
  if (!db.getQuestion(questionId)) {
    const e = new Error("question not found"); e.status = 404; throw e;
  }
  const result = db.recordAttempt({ studentId, questionId, answer, now });
  return { result };
}

/** Dashboard analytics: per-topic mastery/accuracy + overall readiness + due count. */
export function getAnalytics(db, { studentId, now = Date.now() }) {
  const student = db.getStudent(studentId);
  if (!student) { const e = new Error("student not found"); e.status = 404; throw e; }
  const topics = db.getAnalytics(studentId);
  const overallReadiness = readiness(topics.map((t) => ({ mastery: t.mastery })));
  return {
    student,
    overallReadiness,
    dueCount: db.getDueCount(studentId, now),
    topics,
  };
}

/** Admin: add a question. */
export function addQuestion(db, body) {
  const { topicId, prompt, options, answer } = body;
  if (topicId == null || !prompt || !Array.isArray(options) || answer == null) {
    const e = new Error("topicId, prompt, options[] and answer are required");
    e.status = 400;
    throw e;
  }
  if (!options.includes(answer)) {
    const e = new Error("answer must be one of the options");
    e.status = 400;
    throw e;
  }
  const id = db.addQuestion({
    topicId, prompt, options, answer,
    difficulty: body.difficulty ?? 1200, marks: body.marks ?? 1,
  });
  return { questionId: id };
}
