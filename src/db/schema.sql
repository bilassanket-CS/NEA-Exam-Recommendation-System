-- src/db/schema.sql
-- Relational schema for the Exam Question Recommendation System.
-- Linked tables queried with multi-table JOINs + aggregation; writing an attempt
-- updates several tables inside one transaction. All access is parameterised.

PRAGMA foreign_keys = ON;

-- Accounts for every user (students, teachers, admins). Role-based access and
-- authentication are built on this table (features 13 & 14).
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  password_hash TEXT,
  salt          TEXT,
  role          TEXT NOT NULL DEFAULT 'student',  -- 'student' | 'teacher' | 'admin'
  active        INTEGER NOT NULL DEFAULT 1,
  rating        INTEGER NOT NULL DEFAULT 1200      -- Elo ability rating (students)
);

CREATE TABLE IF NOT EXISTS topics (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS questions (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  topic_id          INTEGER NOT NULL REFERENCES topics(id),
  sub_topic         TEXT,                              -- feature 1: sub-topic tag
  type              TEXT NOT NULL DEFAULT 'objective', -- 'objective' | 'written'
  prompt            TEXT NOT NULL,
  options_json      TEXT NOT NULL DEFAULT '[]',        -- JSON array (objective)
  answer            TEXT NOT NULL DEFAULT '',          -- correct option (objective)
  mark_scheme       TEXT,                              -- feature 3: written self-marking
  difficulty_rating INTEGER NOT NULL DEFAULT 1200,     -- Elo difficulty (learned)
  marks             INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS attempts (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id    INTEGER NOT NULL REFERENCES users(id),
  question_id   INTEGER NOT NULL REFERENCES questions(id),
  given_answer  TEXT NOT NULL,
  awarded_marks INTEGER,                  -- written: self-awarded marks
  correct       INTEGER NOT NULL,         -- 0 / 1
  quality       INTEGER NOT NULL,         -- SM-2 quality 0..5
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS student_topic (
  student_id INTEGER NOT NULL REFERENCES users(id),
  topic_id   INTEGER NOT NULL REFERENCES topics(id),
  mastery    REAL NOT NULL DEFAULT 0.5,
  attempts   INTEGER NOT NULL DEFAULT 0,
  correct    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (student_id, topic_id)
);

CREATE TABLE IF NOT EXISTS review_schedule (
  student_id    INTEGER NOT NULL REFERENCES users(id),
  question_id   INTEGER NOT NULL REFERENCES questions(id),
  repetitions   INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER NOT NULL DEFAULT 0,
  easiness      REAL NOT NULL DEFAULT 2.5,
  due_date      INTEGER,
  last_correct  INTEGER,
  PRIMARY KEY (student_id, question_id)
);

-- Login sessions (feature 13).
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic  ON questions(topic_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON sessions(user_id);
