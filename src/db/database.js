// src/db/database.js
// Data-access layer over node:sqlite (built-in, no dependencies).
// All SQL is PARAMETERISED. Reads use multi-table JOINs and GROUP BY aggregation;
// recording an attempt runs inside a TRANSACTION so attempt + mastery + schedule
// + ratings stay consistent. Also provides accounts, roles, sessions, written
// self-marking and question management.

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { sm2, qualityFromAttempt, initialSchedule } from "../engine/spacedRepetition.js";
import { updateRatings } from "../engine/elo.js";
import { updateMasteryValue } from "../engine/mastery.js";
import { hashPassword, verifyPassword, newToken } from "../engine/auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 1 week
const ROLES = new Set(["student", "teacher", "admin"]);

export class Database {
  constructor(location = ":memory:") {
    this.db = new DatabaseSync(location);
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(readFileSync(join(__dirname, "schema.sql"), "utf8"));
  }
  close() { this.db.close(); }

  // ---- users / accounts (features 13 & 14) --------------------------------
  addUser({ name, email = null, password = null, role = "student" }) {
    if (!name || !String(name).trim()) throw badRequest("name is required");
    if (!ROLES.has(role)) throw badRequest(`role must be one of ${[...ROLES].join(", ")}`);
    let hash = null, salt = null;
    if (password != null) ({ hash, salt } = hashPassword(password));
    try {
      return this.db.prepare(
        "INSERT INTO users (name, email, password_hash, salt, role) VALUES (?, ?, ?, ?, ?)"
      ).run(String(name).trim(), email, hash, salt, role).lastInsertRowid;
    } catch (e) {
      if (String(e.message).includes("UNIQUE")) throw badRequest("email already in use");
      throw e;
    }
  }
  /** Backwards-compatible helper: create a learner account. */
  addStudent(name) { return this.addUser({ name, role: "student" }); }

  getUserById(id) {
    return this.db.prepare(
      "SELECT id, name, email, role, active, rating FROM users WHERE id = ?"
    ).get(id);
  }
  getStudent(id) {
    const u = this.getUserById(id);
    return u ? { id: u.id, name: u.name, rating: u.rating, role: u.role } : undefined;
  }
  getUserByEmail(email) {
    return this.db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  }
  listUsers() {
    return this.db.prepare(
      "SELECT id, name, email, role, active, rating FROM users ORDER BY role, name"
    ).all();
  }
  setUserActive(id, active) {
    return this.db.prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id).changes;
  }

  authenticate(email, password) {
    const u = this.getUserByEmail(email);
    if (!u || !u.active) return null;
    if (!verifyPassword(password, u.password_hash, u.salt)) return null;
    return { id: u.id, name: u.name, email: u.email, role: u.role, rating: u.rating };
  }
  createSession(userId, now = Date.now()) {
    const token = newToken();
    this.db.prepare(
      "INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    ).run(token, userId, now, now + SESSION_TTL_MS);
    return token;
  }
  getSessionUser(token, now = Date.now()) {
    if (!token) return null;
    const row = this.db.prepare(
      `SELECT u.id, u.name, u.email, u.role, u.active, u.rating, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ?`
    ).get(token);
    if (!row || row.expires_at < now || !row.active) return null;
    return { id: row.id, name: row.name, email: row.email, role: row.role, rating: row.rating };
  }
  deleteSession(token) {
    return this.db.prepare("DELETE FROM sessions WHERE token = ?").run(token).changes;
  }

  // ---- topics & questions (features 1 & 14) -------------------------------
  addTopic(name) {
    return this.db.prepare("INSERT INTO topics (name) VALUES (?)").run(name).lastInsertRowid;
  }
  getTopics() {
    return this.db.prepare("SELECT id, name FROM topics ORDER BY id").all();
  }
  getTopicById(id) {
    return this.db.prepare("SELECT id, name FROM topics WHERE id = ?").get(id);
  }

  addQuestion({ topicId, subTopic = null, type = "objective", prompt, options = [],
                answer = "", markScheme = null, difficulty = 1200, marks = 1 }) {
    // Validation (feature 15)
    if (topicId == null) throw badRequest("topicId is required");
    if (!this.db.prepare("SELECT 1 FROM topics WHERE id = ?").get(topicId)) throw badRequest("topic does not exist");
    if (!prompt || !String(prompt).trim()) throw badRequest("prompt is required");
    if (!["objective", "written"].includes(type)) throw badRequest("type must be 'objective' or 'written'");
    if (type === "objective") {
      if (!Array.isArray(options) || options.length < 2) throw badRequest("objective questions need at least 2 options");
      if (!options.includes(answer)) throw badRequest("answer must be one of the options");
    } else {
      if (!markScheme || !String(markScheme).trim()) throw badRequest("written questions need a mark scheme");
    }
    if (!Number.isInteger(marks) || marks < 1) throw badRequest("marks must be a positive integer");
    return this.db.prepare(
      `INSERT INTO questions (topic_id, sub_topic, type, prompt, options_json, answer, mark_scheme, difficulty_rating, marks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(topicId, subTopic, type, String(prompt).trim(), JSON.stringify(options),
          answer, markScheme, difficulty, marks).lastInsertRowid;
  }

  updateQuestion(id, fields) {
    const q = this.getQuestion(id);
    if (!q) throw badRequest("question not found");
    const merged = {
      topicId: fields.topicId ?? q.topic_id,
      subTopic: fields.subTopic ?? q.sub_topic,
      type: fields.type ?? q.type,
      prompt: fields.prompt ?? q.prompt,
      options: fields.options ?? q.options,
      answer: fields.answer ?? q.answer,
      markScheme: fields.markScheme ?? q.mark_scheme,
      marks: fields.marks ?? q.marks,
    };
    if (merged.type === "objective" && !merged.options.includes(merged.answer)) {
      throw badRequest("answer must be one of the options");
    }
    this.db.prepare(
      `UPDATE questions SET topic_id = ?, sub_topic = ?, type = ?, prompt = ?, options_json = ?, answer = ?, mark_scheme = ?, marks = ?
       WHERE id = ?`
    ).run(merged.topicId, merged.subTopic, merged.type, merged.prompt,
          JSON.stringify(merged.options), merged.answer, merged.markScheme, merged.marks, id);
    return this.getQuestion(id);
  }

  getQuestion(id) {
    const row = this.db.prepare("SELECT * FROM questions WHERE id = ?").get(id);
    if (row) row.options = JSON.parse(row.options_json);
    return row;
  }
  listQuestions() {
    return this.db.prepare(
      `SELECT q.id, q.prompt, q.type, q.sub_topic, q.difficulty_rating, q.marks, t.name AS topic
       FROM questions q JOIN topics t ON t.id = q.topic_id ORDER BY t.name, q.id`
    ).all();
  }

  // ---- recommendation reads (features 7 & 9) ------------------------------
  getCandidates(studentId) {
    const rows = this.db.prepare(
      `SELECT q.id AS questionId, q.topic_id AS topicId, q.type AS type,
              q.difficulty_rating AS questionRating, q.sub_topic AS subTopic,
              q.prompt AS prompt, q.marks AS marks,
              COALESCE(st.mastery, 0.5) AS mastery,
              rs.due_date AS dueDate, rs.last_correct AS lastCorrect
       FROM questions q
       LEFT JOIN student_topic   st ON st.topic_id = q.topic_id AND st.student_id = ?
       LEFT JOIN review_schedule rs ON rs.question_id = q.id    AND rs.student_id = ?
       ORDER BY q.id`
    ).all(studentId, studentId);
    return rows.map((r) => ({
      questionId: r.questionId, topicId: r.topicId, type: r.type,
      questionRating: r.questionRating, subTopic: r.subTopic, prompt: r.prompt, marks: r.marks,
      mastery: r.mastery,
      dueDate: r.dueDate ?? null,
      lastCorrect: r.lastCorrect == null ? null : !!r.lastCorrect,
    }));
  }

  // ---- Stage 2/3 ML recommender support -----------------------------------
  countAttempts() {
    return this.db.prepare("SELECT COUNT(*) AS n FROM attempts").get().n;
  }
  /** All attempts in chronological order, joined with the question fields the
   *  ML training replay needs (topic, marks, sub-topic/prompt text). */
  getAllAttemptsChronological() {
    return this.db.prepare(
      `SELECT a.id AS id, a.student_id AS studentId, a.question_id AS questionId,
              a.correct AS correct, a.created_at AS createdAt,
              q.topic_id AS topicId, q.marks AS marks, q.sub_topic AS subTopic, q.prompt AS prompt
       FROM attempts a JOIN questions q ON q.id = a.question_id
       ORDER BY a.created_at ASC, a.id ASC`
    ).all();
  }
  /** Most recent attempt's correctness per (student, question) pair, plus the
   *  full id lists — the exact shape src/engine/collaborative.js expects. */
  getOutcomesMatrix() {
    const students = this.db.prepare("SELECT id FROM users WHERE role = 'student'").all().map((r) => r.id);
    const questions = this.db.prepare("SELECT id FROM questions").all().map((r) => r.id);
    const rows = this.db.prepare(
      `SELECT student_id AS studentId, question_id AS questionId, correct
       FROM attempts
       WHERE id IN (SELECT MAX(id) FROM attempts GROUP BY student_id, question_id)`
    ).all();
    const outcomes = new Map();
    for (const r of rows) outcomes.set(`${r.studentId}:${r.questionId}`, r.correct);
    return { students, questions, outcomes };
  }
  /** A student's most recently wrong questions, most-recent-last — the
   *  "seeds" for both the content-based and collaborative-filtering features. */
  getRecentWrongQuestions(studentId, limit = 10) {
    return this.db.prepare(
      `SELECT q.id AS id, q.sub_topic AS subTopic, q.prompt AS prompt
       FROM attempts a JOIN questions q ON q.id = a.question_id
       WHERE a.student_id = ? AND a.correct = 0
       ORDER BY a.created_at DESC, a.id DESC LIMIT ?`
    ).all(studentId, limit).reverse();
  }
  getMasteryMap(studentId) {
    const rows = this.db.prepare(
      "SELECT topic_id AS topicId, mastery FROM student_topic WHERE student_id = ?"
    ).all(studentId);
    return new Map(rows.map((r) => [r.topicId, r.mastery]));
  }
  getAnalytics(studentId) {
    return this.db.prepare(
      `SELECT t.id AS topicId, t.name AS topic,
              COALESCE(st.mastery, 0.5) AS mastery,
              COALESCE(st.attempts, 0) AS attempts,
              COALESCE(st.correct, 0)  AS correct,
              CASE WHEN COALESCE(st.attempts,0)=0 THEN 0
                   ELSE ROUND(100.0*st.correct/st.attempts) END AS accuracy
       FROM topics t
       LEFT JOIN student_topic st ON st.topic_id = t.id AND st.student_id = ?
       ORDER BY mastery ASC, t.name ASC`
    ).all(studentId);
  }
  getDueCount(studentId, now = Date.now()) {
    return this.db.prepare(
      "SELECT COUNT(*) AS n FROM review_schedule WHERE student_id = ? AND due_date IS NOT NULL AND due_date <= ?"
    ).get(studentId, now).n;
  }

  // ---- recording an attempt (features 2, 3, 4, 5, 10) ---------------------
  recordAttempt({ studentId, questionId, answer, awarded = null, now = Date.now() }) {
    const question = this.getQuestion(questionId);
    if (!question) throw badRequest("question not found");
    if (!this.getUserById(studentId)) throw badRequest("student not found");

    let correct, quality, outcome, givenAnswer, awardedMarks = null;
    if (question.type === "written") {
      // Self-marked against the mark scheme (feature 3).
      const max = question.marks;
      const marks = Number(awarded);
      if (!Number.isFinite(marks) || marks < 0 || marks > max) {
        throw badRequest(`awarded marks must be a number between 0 and ${max}`);
      }
      awardedMarks = Math.round(marks);
      outcome = max === 0 ? 0 : awardedMarks / max;      // fraction 0..1
      correct = outcome >= 0.5;
      quality = Math.max(0, Math.min(5, Math.round(outcome * 5)));
      givenAnswer = answer == null ? "" : String(answer);
    } else {
      // Objective auto-marking (feature 2).
      const blank = answer == null || String(answer).trim() === "";
      correct = !blank && String(answer).trim() === String(question.answer).trim();
      quality = qualityFromAttempt({ correct, blank });
      outcome = correct ? 1 : 0;
      givenAnswer = blank ? "" : String(answer);
    }

    this.db.prepare("BEGIN").run();
    try {
      this.db.prepare(
        `INSERT INTO attempts (student_id, question_id, given_answer, awarded_marks, correct, quality, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(studentId, questionId, givenAnswer, awardedMarks, correct ? 1 : 0, quality, now);

      // mastery (feature 4) — EMA toward the outcome fraction
      const stRow = this.db.prepare(
        "SELECT mastery FROM student_topic WHERE student_id = ? AND topic_id = ?"
      ).get(studentId, question.topic_id);
      const prevMastery = stRow ? stRow.mastery : 0.5;
      const newMastery = updateMasteryValue(prevMastery, outcome);
      if (stRow) {
        this.db.prepare(
          `UPDATE student_topic SET mastery = ?, attempts = attempts + 1, correct = correct + ?
           WHERE student_id = ? AND topic_id = ?`
        ).run(newMastery, correct ? 1 : 0, studentId, question.topic_id);
      } else {
        this.db.prepare(
          `INSERT INTO student_topic (student_id, topic_id, mastery, attempts, correct)
           VALUES (?, ?, ?, 1, ?)`
        ).run(studentId, question.topic_id, newMastery, correct ? 1 : 0);
      }

      // spaced repetition (feature 5)
      const schedRow = this.db.prepare(
        "SELECT repetitions, interval_days, easiness FROM review_schedule WHERE student_id = ? AND question_id = ?"
      ).get(studentId, questionId);
      const prev = schedRow
        ? { repetitions: schedRow.repetitions, interval: schedRow.interval_days, easiness: schedRow.easiness }
        : initialSchedule();
      const next = sm2(prev, quality);
      const dueDate = now + next.interval * 24 * 3600 * 1000;
      if (schedRow) {
        this.db.prepare(
          `UPDATE review_schedule SET repetitions=?, interval_days=?, easiness=?, due_date=?, last_correct=?
           WHERE student_id=? AND question_id=?`
        ).run(next.repetitions, next.interval, next.easiness, dueDate, correct ? 1 : 0, studentId, questionId);
      } else {
        this.db.prepare(
          `INSERT INTO review_schedule (student_id, question_id, repetitions, interval_days, easiness, due_date, last_correct)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(studentId, questionId, next.repetitions, next.interval, next.easiness, dueDate, correct ? 1 : 0);
      }

      // Elo ratings (feature 5 / difficulty modelling)
      const student = this.getUserById(studentId);
      const { studentRating, questionRating } = updateRatings(student.rating, question.difficulty_rating, correct);
      this.db.prepare("UPDATE users SET rating = ? WHERE id = ?").run(studentRating, studentId);
      this.db.prepare("UPDATE questions SET difficulty_rating = ? WHERE id = ?").run(questionRating, questionId);

      this.db.prepare("COMMIT").run();
      return {
        correct, blank: question.type === "objective" && givenAnswer === "",
        type: question.type,
        correctAnswer: question.type === "objective" ? question.answer : undefined,
        markScheme: question.type === "written" ? question.mark_scheme : undefined,
        awardedMarks, maxMarks: question.marks,
        quality, mastery: newMastery,
        nextDueDate: dueDate, intervalDays: next.interval,
        studentRating, questionRating,
      };
    } catch (err) {
      this.db.prepare("ROLLBACK").run();
      throw err;
    }
  }

  // ---- site settings (theme) ----------------------------------------------
  getSetting(name) {
    const row = this.db.prepare("SELECT value FROM settings WHERE name = ?").get(name);
    return row ? row.value : null;
  }
  setSetting(name, value) {
    this.db.prepare(
      "INSERT INTO settings (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value"
    ).run(name, value);
  }
}

function badRequest(message) {
  const e = new Error(message);
  e.status = 400;
  return e;
}
