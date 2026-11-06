# Features

This file outlines the **15 essential features** of StudyTrackr (from the NEA Analysis)
and shows where each one is implemented in the codebase.
All fifteen are implemented and covered by automated tests (`npm test`).

| # | Feature | Status | Implemented in |
| --- | --- | --- | --- |
| 1 | Tagged question bank (topic, sub-topic, difficulty, marks) | Done | `src/db/schema.sql` (`questions`), `src/db/seed.js`, `src/db/database.js` → `addQuestion` |
| 2 | Automatic marking of objective questions | Done | `src/db/database.js` → `recordAttempt` (objective branch) |
| 3 | Self-marking of extended answers against a mark scheme | Done | `src/db/database.js` → `recordAttempt` (written branch); UI in `public/app.js` |
| 4 | Per-topic mastery estimation | Done | `src/engine/mastery.js` (`updateMasteryValue`); stored in `student_topic` |
| 5 | Adaptive difficulty (Elo rating) | Done | `src/engine/elo.js`; applied in `recordAttempt` |
| 6 | Spaced-repetition scheduling with a priority queue | Done | `src/engine/spacedRepetition.js` (SM-2) + `src/engine/priorityQueue.js` (max-heap) |
| 7 | Weighted recommendation engine | Done | `src/engine/recommender.js` |
| 8 | Explainable recommendations | Done | `src/engine/recommender.js` (`reasons`); shown in the UI |
| 9 | Relational data model with parameterised multi-table SQL | Done | `src/db/schema.sql`; `getCandidates`, `getAnalytics` (JOIN + GROUP BY) |
| 10 | Consistent, transactional updates | Done | `src/db/database.js` → `recordAttempt` (BEGIN/COMMIT/ROLLBACK) |
| 11 | Analytics dashboard with progress charts | Done | `getAnalytics` + Dashboard tab in `public/index.html` / `public/app.js` |
| 12 | Predicted readiness indicator | Done | `src/engine/mastery.js` (`readiness`); shown on the Dashboard |
| 13 | Authentication and user accounts | Done | `src/engine/auth.js`, `sessions`/`users` tables, `/api/auth/*` |
| 14 | Role-based access and content management | Done | `src/api/handlers.js` (role checks) + `src/server.js` routes; Admin tab |
| 15 | Input validation and data-integrity safeguards | Done | `addQuestion`/`recordAttempt` validation; foreign keys in `schema.sql` |

## Extensions beyond the original 15: the Adaptive AI recommendation pipeline

Feature 7 (the weighted recommender) is now Stage 1 of a 3-stage pipeline, used as the
cold-start fallback. The live `/api/recommendations` endpoint calls `recommendML()`.

| # | Feature | Status | Implemented in |
| --- | --- | --- | --- |
| 16 | Content-based filtering (sub-topic text similarity to recently-missed questions) | Done | `src/engine/contentFeatures.js` |
| 17 | Collaborative filtering wired into live recommendations | Done | `src/engine/collaborative.js` (`buildQuestionVectors`, `cfSimilarityScore`), `Database.getOutcomesMatrix` |
| 18 | Hand-rolled machine learning — logistic regression trained (gradient descent) on real attempt history, replacing fixed weights | Done | `src/engine/mlRecommender.js` |
| 19 | OCR mark-scheme retrieval (TF-IDF search) + similar-question suggestions on a wrong answer | Done | `src/engine/retrieval.js`, `src/db/pastPapers.js`, `public/app.js` |

## Notes on the three features added in this revision

- **Feature 3 — written self-marking.** Questions now have a `type` of `objective` or
  `written`. Written questions carry a `mark_scheme` and a mark total; the student types
  an answer, then self-awards marks (validated against the maximum), which feed the same
  mastery, spaced-repetition and difficulty models as objective questions.
- **Feature 13 — authentication.** Passwords are hashed with scrypt and a per-user salt
  (`src/engine/auth.js`). Logging in issues a session token; protected endpoints require
  `Authorization: Bearer <token>`.
- **Feature 14 — roles and content management.** Every account has a role
  (`student` / `teacher` / `admin`). Teachers and admins can add and edit questions;
  admins can list, create and disable accounts. Students can only practise and see their
  own data (ownership is enforced in `src/api/handlers.js`).

## Demo accounts (created by the seed)

| Role | Email | Password |
| --- | --- | --- |
| Student | student@example.com | student123 |
| Teacher | teacher@example.com | teacher123 |
| Admin | admin@example.com | admin123 |

## Run

```bash
npm start     # http://localhost:3000
npm test      # all tests
```
