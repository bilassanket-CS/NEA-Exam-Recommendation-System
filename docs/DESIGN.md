# Design Document

This document covers the **plan** and **design** stages for the Exam Question
Recommendation System, to accompany the codebase.

## 1. Problem and end user

Revision practice is undirected: students work through past papers in any order,
marking is manual, difficulty is the same for everyone, and progress is invisible.
The **end user** is an A Level student (with a secondary teacher/admin role). The
system targets each student's weakest topics at an appropriate difficulty and
resurfaces material at the right time.

## 2. Measurable success criteria

| # | Criterion | How it is checked |
| --- | --- | --- |
| S1 | A recommended question comes from the student's weaker topics when such topics exist. | `recommender` unit tests; live dashboard. |
| S2 | Objective answers are auto-marked instantly. | `recordAttempt` tests; UI feedback. |
| S3 | Wrong answers are scheduled to reappear sooner than mastered ones. | SM-2 tests (lapse → 1 day). |
| S4 | Difficulty adapts to the student over time. | Elo tests; rating changes after attempts. |
| S5 | The dashboard shows per-topic mastery and an overall readiness figure. | `getAnalytics` test; dashboard. |
| S6 | The API never reveals answers in recommendations. | API test asserts no `answer` field. |
| S7 | Invalid input is handled safely (blank answer, unknown student). | API/db tests for 404 and blank. |

## 3. Data model

Six tables (entities and key fields):

- **topics**(id, name)
- **questions**(id, topic_id→topics, prompt, options_json, answer, difficulty_rating, marks)
- **students**(id, name, rating)
- **attempts**(id, student_id→students, question_id→questions, given_answer, correct, quality, created_at)
- **student_topic**(student_id, topic_id, mastery, attempts, correct) — running mastery
- **review_schedule**(student_id, question_id, repetitions, interval_days, easiness, due_date, last_correct) — SM-2 state

Relationships: a topic has many questions; a student has many attempts; each
(student, topic) has one mastery row; each (student, question) has one schedule row.

```
topics 1───∞ questions 1───∞ attempts ∞───1 students
   │                                   │
   └────── student_topic ──────────────┘
              review_schedule (student × question)
```

## 4. Algorithm design

### 4.1 Mastery (per topic)
`mastery' = mastery + α(outcome − mastery)`, with α = 0.3, outcome ∈ {0,1}.
Recent results dominate; value stays in [0,1].

### 4.2 Spaced repetition (SM-2)
Maintain repetitions `n`, interval `I`, easiness `EF` per (student, question).
On each attempt with quality `q` (0–5):
- `EF ← EF + (0.1 − (5−q)(0.08 + (5−q)0.02))`, floored at 1.3
- if `q < 3`: `n ← 0`, `I ← 1` (lapse)
- else: `I ← 1, 6, round(I·EF)` for the 1st, 2nd, later reviews; `n ← n+1`
Next due date = now + I days.

### 4.3 Difficulty (Elo)
`E = 1/(1 + 10^((Rq − Rs)/400))`. After an attempt:
`Rs ← Rs + K(score − E)` and the question moves oppositely (K = 24).

### 4.4 Selection / ranking
For each candidate question:
```
weakness   = 1 − topicMastery
due        = 1 if overdue, scaled down if in the future, 0.5 if unseen
difficulty = closeness of P(student wins) to a target 0.6 (slightly challenging)
score      = 0.5·weakness + 0.3·due + 0.2·difficulty
```
Candidates are pushed into a **max-heap** and the top `k` are popped. Each result
carries human-readable reasons (explainability).

### 4.5 Collaborative filtering (stretch)
Build a question×student outcome matrix; for questions the target got wrong,
find similar questions by **cosine similarity** and recommend the unseen ones.

## 5. Key design decisions

- **No external dependencies** (Node built-ins only) so the project is easy to run,
  mark and version-control, and there is no hidden library doing the clever part.
- **SQLite with parameterised SQL** to demonstrate a real relational model with
  joins, aggregation and transactions, rather than a single flat file.
- **Engine separated from I/O** so the algorithms are pure and unit-testable.
- **Answers withheld** from the recommendation endpoint for integrity.

## 6. Possible extensions

Written-answer self-marking against a mark scheme, misconception-tagged distractors,
an AI tutor/hint helper, exam-board predicted papers, a React/Next.js front end, and a
companion mobile app.
