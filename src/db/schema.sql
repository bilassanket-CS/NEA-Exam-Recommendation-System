-- src/db/schema.sql
-- Relational schema for the Exam Question Recommendation System.
-- Five linked tables; the recommender reads them with multi-table JOINs and
-- aggregation, and writes attempts/mastery/schedule inside a transaction.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS topics (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS questions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id          INTEGER NOT NULL REFERENCES topics(id),
  prompt            TEXT NOT NULL,
  options_json      TEXT NOT NULL,            -- JSON array of answer options
  answer            TEXT NOT NULL,            -- the correct option (verbatim)
  difficulty_rating INTEGER NOT NULL DEFAULT 1200, -- Elo rating, learned over time
  marks             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS students (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  name    TEXT NOT NULL,
  rating  INTEGER NOT NULL DEFAULT 1200       -- Elo rating, learned over time
);

CREATE TABLE IF NOT EXISTS attempts (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id   INTEGER NOT NULL REFERENCES students(id),
  question_id  INTEGER NOT NULL REFERENCES questions(id),
  given_answer TEXT NOT NULL,
  correct      INTEGER NOT NULL,              -- 0 / 1
  quality      INTEGER NOT NULL,              -- SM-2 quality 0..5
  created_at   INTEGER NOT NULL               -- ms timestamp
);

-- Running per-(student, topic) mastery estimate (0..1) and counts.
CREATE TABLE IF NOT EXISTS student_topic (
  student_id INTEGER NOT NULL REFERENCES students(id),
  topic_id   INTEGER NOT NULL REFERENCES topics(id),
  mastery    REAL NOT NULL DEFAULT 0.5,
  attempts   INTEGER NOT NULL DEFAULT 0,
  correct    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, topic_id)
);

-- Spaced-repetition schedule per (student, question).
CREATE TABLE IF NOT EXISTS review_schedule (
  student_id    INTEGER NOT NULL REFERENCES students(id),
  question_id   INTEGER NOT NULL REFERENCES questions(id),
  repetitions   INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  easiness      REAL NOT NULL DEFAULT 2.5,
  due_date      INTEGER,                       -- ms timestamp, null = unseen
  last_correct  INTEGER,                       -- 0 / 1, null = unseen
  PRIMARY KEY (student_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic  ON questions(topic_id);
