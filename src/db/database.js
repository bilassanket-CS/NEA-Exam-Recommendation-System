// src/db/database.js
// Data-access layer over node:sqlite (built-in, no dependencies).
// All SQL is PARAMETERISED (no string concatenation). Recommendation reads use
// multi-table JOINs and GROUP BY aggregation; recording an attempt runs inside a
// TRANSACTION so attempt + mastery + schedule + ratings stay consistent.

import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { sm2, qualityFromAttempt, initialSchedule } from "../engine/spacedRepetition.js";
import { updateRatings } from "../engine/elo.js";
import { updateMastery } from "../engine/mastery.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

export class Database {
  /** @param {string} location ':memory:' or a file path */
  constructor(location = ":memory:") {
    this.db = new DatabaseSync(location);
    this.db.exec("PRAGMA foreign_keys = ON;");
    const schema = readFileSync(join(__dirname, "schema.sql"), "utf8");
    this.db.exec(schema);
  }

  close() {
    this.db.close();
  }

  // ---- topics & questions -------------------------------------------------
  addTopic(name) {
    return this.db.prepare("INSERT INTO topics (name) VALUES (?)").run(name).lastInsertRowid;
  }
  getTopics() {
    return this.db.prepare("SELECT id, name FROM topics ORDER BY id").all();
  }
  addQuestion({ topicId, prompt, options, answer, difficulty = 1200, marks = 1 }) {
    return this.db.prepare(
      `INSERT INTO questions (topic_id, prompt, options_json, answer, difficulty_rating, marks)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(topicId, prompt, JSON.stringify(options), answer, difficulty, marks).lastInsertRowid;
  }
  getQuestion(id) {
    const row = this.db.prepare("SELECT * FROM questions WHERE id = ?").get(id);
    if (row) row.options = JSON.parse(row.options_json);
    return row;
  }

  // ---- students -----------------------------------------------------------
  addStudent(name) {
    return this.db.prepare("INSERT INTO students (name) VALUES (?)").run(name).lastInsertRowid;
  }
  getStudent(id) {
    return this.db.prepare("SELECT id, name, rating FROM students WHERE id = ?").get(id);
  }

  /**
   * Candidate pool for a student: every question LEFT JOINed to that student's
   * mastery and review schedule. This is the multi-table query the recommender
   * consumes. Returns rows shaped for the engine.
   */
  getCandidates(studentId) {
    const rows = this.db.prepare(
      `SELECT q.id            AS questionId,
              q.topic_id      AS topicId,
              q.difficulty_rating AS questionRating,
              COALESCE(st.mastery, 0.5) AS mastery,
              rs.due_date     AS dueDate,
              rs.last_correct AS lastCorrect
       FROM questions q
       LEFT JOIN student_topic   st ON st.topic_id = q.topic_id AND st.student_id = ?
       LEFT JOIN review_schedule rs ON rs.question_id = q.id    AND rs.student_id = ?
       ORDER BY q.id`
    ).all(studentId, studentId);
    return rows.map((r) => ({
      questionId: r.questionId,
      topicId: r.topicId,
      questionRating: r.questionRating,
      mastery: r.mastery,
      dueDate: r.dueDate ?? null,
      lastCorrect: r.lastCorrect == null ? null : !!r.lastCorrect,
    }));
  }

  /** Map of topicId -> mastery for a student (defaults to 0.5 when unseen). */
  getMasteryMap(studentId) {
    const rows = this.db.prepare(
      "SELECT topic_id AS topicId, mastery FROM student_topic WHERE student_id = ?"
    ).all(studentId);
    return new Map(rows.map((r) => [r.topicId, r.mastery]));
  }

  /**
   * Per-topic analytics for a student via GROUP BY aggregation:
   * mastery, attempts, correct and accuracy for every topic.
   */
  getAnalytics(studentId) {
    return this.db.prepare(
      `SELECT t.id   AS topicId,
              t.name AS topic,
              COALESCE(st.mastery, 0.5)  AS mastery,
              COALESCE(st.attempts, 0)   AS attempts,
              COALESCE(st.correct, 0)    AS correct,
              CASE WHEN COALESCE(st.attempts,0) = 0 THEN 0
                   ELSE ROUND(100.0 * st.correct / st.attempts) END AS accuracy
       FROM topics t
       LEFT JOIN student_topic st ON st.topic_id = t.id AND st.student_id = ?
       ORDER BY mastery ASC, t.name ASC`
    ).all(studentId);
  }

  /** How many questions are due for review right now. */
  getDueCount(studentId, now = Date.now()) {
    return this.db.prepare(
      "SELECT COUNT(*) AS n FROM review_schedule WHERE student_id = ? AND due_date IS NOT NULL AND due_date <= ?"
    ).get(studentId, now).n;
  }

  /**
   * Auto-mark and record an attempt, then update mastery, the SM-2 schedule and
   * the Elo ratings of both the student and the question — all in one TRANSACTION.
   * @returns {object} feedback for the client
   */
  recordAttempt({ studentId, questionId, answer, now = Date.now() }) {
    const question = this.getQuestion(questionId);
    if (!question) throw new Error(`question ${questionId} not found`);
    const student = this.getStudent(studentId);
    if (!student) throw new Error(`student ${studentId} not found`);

    const blank = answer == null || String(answer).trim() === "";
    const correct = !blank && String(answer).trim() === String(question.answer).trim();
    const quality = qualityFromAttempt({ correct, blank });

    const tx = this.db.prepare("BEGIN");
    tx.run();
    try {
      // 1. attempt row
      this.db.prepare(
        `INSERT INTO attempts (student_id, question_id, given_answer, correct, quality, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(studentId, questionId, blank ? "" : String(answer), correct ? 1 : 0, quality, now);

      // 2. mastery upsert
      const stRow = this.db.prepare(
        "SELECT mastery, attempts, correct FROM student_topic WHERE student_id = ? AND topic_id = ?"
      ).get(studentId, question.topic_id);
      const prevMastery = stRow ? stRow.mastery : 0.5;
      const newMastery = updateMastery(prevMastery, correct);
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

      // 3. spaced-repetition schedule upsert (SM-2)
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
          `UPDATE review_schedule SET repetitions = ?, interval_days = ?, easiness = ?, due_date = ?, last_correct = ?
           WHERE student_id = ? AND question_id = ?`
        ).run(next.repetitions, next.interval, next.easiness, dueDate, correct ? 1 : 0, studentId, questionId);
      } else {
        this.db.prepare(
          `INSERT INTO review_schedule (student_id, question_id, repetitions, interval_days, easiness, due_date, last_correct)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        ).run(studentId, questionId, next.repetitions, next.interval, next.easiness, dueDate, correct ? 1 : 0);
      }

      // 4. Elo ratings update
      const { studentRating, questionRating } = updateRatings(student.rating, question.difficulty_rating, correct);
      this.db.prepare("UPDATE students SET rating = ? WHERE id = ?").run(studentRating, studentId);
      this.db.prepare("UPDATE questions SET difficulty_rating = ? WHERE id = ?").run(questionRating, questionId);

      this.db.prepare("COMMIT").run();

      return {
        correct,
        blank,
        correctAnswer: question.answer,
        quality,
        mastery: newMastery,
        nextDueDate: dueDate,
        intervalDays: next.interval,
        studentRating,
        questionRating,
      };
    } catch (err) {
      this.db.prepare("ROLLBACK").run();
      throw err;
    }
  }
}
