# Features

The Exam Question Recommendation System implements the fifteen essential features
identified in the Analysis. Each feature below is described and then mapped to the
part of the codebase that provides it, so the implementation can be checked against
the design. All features run with **zero external dependencies** (Node.js built-ins
only) and are covered by the automated test suite (`npm test`).

| # | Feature | Status | Where it lives |
| --- | --- | --- | --- |
| 1 | Tagged question bank | Implemented | `src/db/schema.sql`, `src/db/seed.js` |
| 2 | Automatic marking of objective questions | Implemented | `src/db/database.js` (`recordAttempt`) |
| 3 | Self-marking of written answers against a mark scheme | Implemented | `database.js`, `handlers.js`, `public/app.js` |
| 4 | Per-topic mastery estimation | Implemented | `src/engine/mastery.js` |
| 5 | Adaptive difficulty (Elo) | Implemented | `src/engine/elo.js` |
| 6 | Spaced repetition (SM-2) with a priority queue | Implemented | `src/engine/spacedRepetition.js`, `priorityQueue.js` |
| 7 | Weighted recommendation engine | Implemented | `src/engine/recommender.js` |
| 8 | Explainable recommendations | Implemented | `recommender.js` (reasons) |
| 9 | Relational data model with parameterised multi-table SQL | Implemented | `src/db/database.js` |
| 10 | Consistent, transactional updates | Implemented | `database.js` (`recordAttempt` transaction) |
| 11 | Analytics dashboard with progress trends | Implemented | `getAnalytics`, `getRecentAttempts`, `public/app.js` |
| 12 | Predicted readiness indicator | Implemented | `src/engine/mastery.js` (`readiness`) |
| 13 | Authentication and user accounts | Implemented | `src/auth.js`, `database.js`, `server.js` |
| 14 | Role-based access and content management | Implemented | `handlers.js`, `server.js`, `public/app.js` |
| 15 | Input validation and data-integrity safeguards | Implemented | `handlers.js`, `schema.sql` (foreign keys) |

## The fifteen features in detail

1. **Tagged question bank.** Every question stores a topic, an optional sub-topic,
   a difficulty rating and a mark allocation, so the engine can target weak areas
   and produce per-topic analytics.

2. **Automatic marking of objective questions.** Multiple-choice and short exact
   answers are marked the instant they are submitted by comparing to the stored
   answer, giving immediate feedback and removing marking from teachers.

3. **Self-marking of written answers against a mark scheme.** Written questions
   store a mark scheme and a maximum mark. The student writes an answer, reveals the
   mark scheme, and awards themselves marks; the ratio is converted to a pass/fail
   and an SM-2 quality so written work feeds the same models as objective work.

4. **Per-topic mastery estimation.** A mastery value (0–1) is held for each student
   and topic and updated after every attempt using an exponential moving average,
   so recent performance counts most.

5. **Adaptive difficulty (Elo).** Students and questions both hold an Elo rating
   that updates after each attempt, so difficulty is learned from real performance.

6. **Spaced repetition with a priority queue.** An SM-2 schedule decides when each
   question should reappear; due questions are organised with a from-scratch
   max-heap priority queue.

7. **Weighted recommendation engine.** Each candidate question is scored by combining
   topic weakness, due-for-review status and difficulty match, and the best are
   selected — the core "what to do next" decision.

8. **Explainable recommendations.** Every recommended question carries the reasons it
   was chosen (for example "weak topic" or "due for review").

9. **Relational data model with parameterised multi-table SQL.** Linked tables are
   queried with parameterised JOINs and GROUP BY aggregation; parameterisation
   protects against SQL injection.

10. **Consistent, transactional updates.** Recording an attempt updates the attempt,
    the topic mastery, the review schedule and both Elo ratings inside one
    transaction, so a failure cannot leave the data half-updated.

11. **Analytics dashboard with progress trends.** Per-topic mastery, accuracy and
    attempts are shown, along with a trend of recent results, satisfying the student
    and teacher needs for visible progress.

12. **Predicted readiness indicator.** Overall mastery is summarised into a single
    readiness percentage as an at-a-glance measure of exam preparedness.

13. **Authentication and user accounts.** Users log in with an email and password;
    passwords are hashed with scrypt and a per-user salt, and sessions use random
    tokens. Each user's history is private to their account.

14. **Role-based access and content management.** Three roles exist — student,
    teacher and admin. Students only practise and view their own progress; teachers
    view class/student analytics and manage the question bank; admins also manage
    user accounts. Access is enforced on every protected route.

15. **Input validation and data-integrity safeguards.** Blank or malformed answers,
    questions without a topic, answers not among the options and invalid roles are
    rejected, and foreign keys prevent orphaned records.

## Demo accounts (seeded)

| Role | Email | Password |
| --- | --- | --- |
| Student | student@example.com | student123 |
| Teacher | teacher@example.com | teacher123 |
| Admin | admin@example.com | admin123 |

## Try each feature quickly

```bash
npm start            # http://localhost:3000
# Log in as the student to see features 1–12 (practice + dashboard, objective + written).
# Log in as the teacher to view student analytics and the question bank (feature 14).
# Log in as the admin to manage users and add questions (features 14 & 15).
npm test             # exercises all features (features 2–15 have automated tests)
```
