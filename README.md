# StudyTrackr

An adaptive revision platform that holds a bank of exam-style questions, tests the
student, and **recommends the next questions that will help them most** — targeting
weak topics at the right difficulty and resurfacing material at the right time.

Built for an **OCR A Level Computer Science NEA**. The whole project runs on
**Node.js with zero external dependencies** (built-in HTTP server, built-in SQLite,
built-in test runner), so it installs and runs instantly and is easy to mark.

---

## Quick start

```bash
# Requires Node.js v22.5 or newer (for the built-in node:sqlite module)
node --version

# Run the app (serves the API and web UI on http://localhost:3000)
npm start
# then open http://localhost:3000
#
# Demo logins (created automatically):
#   student@example.com / student123   (practise + dashboard)
#   teacher@example.com / teacher123   (add/edit questions, class analytics)
#   admin@example.com   / admin123     (manage accounts + content)

# Run the automated tests
npm test
```

There is nothing to install — there are no third-party packages.

### Demo accounts (seeded on first run)

| Role | Email | Password |
| --- | --- | --- |
| Student | student@example.com | student123 |
| Teacher | teacher@example.com | teacher123 |
| Admin | admin@example.com | admin123 |

By default the server uses an **in-memory** database that is re-seeded each run.
To keep data between runs, set a file:

```bash
DB_FILE=data.db npm start
```

---

## What it does

- **Question bank** tagged by topic and difficulty (OCR-style Computer Science seed data).
- **Accounts and roles**: users log in (passwords hashed with scrypt). Three roles —
  **student**, **teacher**, **admin** — see different screens (role-based access).
- **Practice**: the UI requests a recommended question, the student answers, and
  **objective** answers are **auto-marked**; **written** answers are **self-marked**
  against a revealed mark scheme.
- **Recommendation engine** chooses the next questions by combining three signals:
  weak-topic priority, due-for-review (spaced repetition), and difficulty match.
- **Dashboard**: per-topic mastery bars, accuracy, ability rating and an overall
  readiness estimate.

## Architecture

```
Browser (public/)  ──HTTP/JSON──►  Node server (src/server.js)
  index.html / app.js                 │
  styles.css                          ├─ src/api/handlers.js   request handlers
                                      ├─ src/engine/*          recommendation logic
                                      └─ src/db/database.js    SQLite (node:sqlite)
```

### The recommendation engine (`src/engine/`)

| Module | Responsibility |
| --- | --- |
| `mastery.js` | Per-topic mastery as an exponential moving average (0–1). |
| `spacedRepetition.js` | **SM-2** algorithm: when to review each question. |
| `elo.js` | **Elo** ratings for students and questions (difficulty modelling). |
| `priorityQueue.js` | From-scratch **max-heap** used to select the top questions. |
| `recommender.js` | Scores candidates (weakness + due + difficulty) and ranks them. |
| `collaborative.js` | Stretch: item-based **collaborative filtering** (cosine similarity). |

### Database (`src/db/`)

Five linked tables (`topics`, `questions`, `students`, `attempts`, `student_topic`,
`review_schedule`). Reads use **multi-table JOINs and GROUP BY aggregation**; recording
an attempt runs inside a **transaction** that updates the attempt, mastery, the SM-2
schedule and both Elo ratings together. All SQL is **parameterised**.

## API

Protected endpoints require an `Authorization: Bearer <token>` header obtained from `/api/auth/login`.


| Method & path | Purpose |
| --- | --- |
| `POST /api/auth/register` | Self-register a student `{ name, email, password }`; returns a token. |
| `POST /api/auth/login` | Log in `{ email, password }`; returns a token. |
| `GET /api/auth/me` | Current user (from the Bearer token). |
| `GET /api/health` | Liveness check. |
| `GET /api/topics` | List topics. |
| `POST /api/students` | Create a student `{ name }`. |
| `GET /api/students/:id` | Get a student. |
| `GET /api/recommendations?studentId=&limit=` | Ranked next questions (no answers). |
| `POST /api/attempts` | Submit `{ studentId, questionId, answer }`; auto-marks + updates models. |
| `GET /api/analytics?studentId=` | Per-topic mastery/accuracy + readiness + due count. |
| `GET /api/recommendations?limit=` | Ranked next questions for the logged-in student (no answers). |
| `GET /api/students` | Teacher/admin: list students. |
| `GET /api/questions` | Teacher/admin: list questions. |
| `POST /api/questions` | Teacher/admin: add a question (objective or written). |
| `PUT /api/questions/:id` | Teacher/admin: edit/tag a question. |
| `GET /api/questions/:id/markscheme` | Reveal a written question's mark scheme (for self-marking). |
| `GET /api/users` `POST /api/users` `PATCH /api/users/:id/active` | Admin: manage user accounts. |

## Testing

```bash
npm test
```

Covers the SM-2 schedule (including lapses and the easiness floor), Elo updates,
mastery bounds, the max-heap ordering, the recommender's ranking rules, collaborative
filtering, the database layer (auto-marking, transactions, aggregation) and the HTTP
API (including that answers are never leaked and unknown students return 404).
See `docs/TESTPLAN.md` for the normal / boundary / erroneous test matrix.

## Project layout

```
src/engine/   recommendation algorithms (pure, unit-tested)
src/db/       schema.sql, seed data, SQLite data-access layer
src/api/      request handlers
src/server.js HTTP server + static file serving
public/       web UI (HTML/CSS/vanilla JS, no build step)
test/         automated tests (node:test)
docs/         DESIGN.md and TESTPLAN.md
```

## Put this on GitHub (version control)

This folder is already a Git repository with commit history. To publish it:

1. Create an empty repository on GitHub (no README/licence) called, e.g.,
   `exam-question-recommendation-system`.
2. Then run (replace `YOUR-USERNAME`):

```bash
git remote add origin https://github.com/YOUR-USERNAME/exam-question-recommendation-system.git
git branch -M main
git push -u origin main
```

A helper script is included: `bash scripts/push-to-github.sh YOUR-USERNAME repo-name`.

## Deploying to examprep.sanketbilas.online

`.github/workflows/deploy.yml` runs the test suite, then syncs this repo over FTP to
the cPanel-hosted Node.js App (Phusion Passenger, `passenger.js` as the startup file)
on every push to `main`. A fresh timestamp is written into `tmp/restart.txt` before
the sync, so it's always re-uploaded with a new mtime, which Passenger treats as a
restart signal.

The FTP account should be one scoped to the app's own folder (cPanel → Files → FTP
Accounts → Directory `examprep.sanketbilas.online`), not the master cPanel login — if
its credentials ever leak, the blast radius is just this folder.

It needs these set under **Settings → Secrets and variables → Actions** on GitHub
(never commit these values):

| Name | Kind | Value |
| --- | --- | --- |
| `DEPLOY_FTP_USER` | Secret | `studytrackr@sanketbilas.online` |
| `DEPLOY_FTP_PASSWORD` | Secret | The FTP account's password |
| `DEPLOY_HOST` | Variable | The FTP server address shown on cPanel's FTP Accounts page |
| `DEPLOY_FTP_PROTOCOL` | Variable | `ftps` if the host supports FTP-over-TLS (preferred — credentials aren't sent in the clear), otherwise `ftp` |

The deploy excludes `.git/`, `.github/`, `node_modules/`, `data.db` and `.env`, so a
live server-side database file is never overwritten by a push.

## Mapping to the NEA

- **Complexity**: own algorithms (SM-2, Elo, ranking), a from-scratch max-heap,
  multi-table parameterised SQL with aggregation, and a transactional write path.
- **Design**: see `docs/DESIGN.md` (success criteria, data model, algorithm design).
- **Testing**: see `docs/TESTPLAN.md` and the `test/` suite (normal, boundary, erroneous).
- **Feature list**: see `docs/Features.md` for all 15 features and where each is implemented.

> Educational project. Not affiliated with any exam board.
# NEA-Exam-Recommendation-System
