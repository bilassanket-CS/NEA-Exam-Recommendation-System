# Test Plan

Testing uses **normal**, **boundary** and **erroneous** data, plus integration tests
through the HTTP API. All tests are automated with Node's built-in runner: `npm test`.

## Automated test matrix

| # | Test | Data type | Expected result | Automated in |
| --- | --- | --- | --- | --- |
| T1 | First two correct reviews | Normal | Intervals become 1 then 6 days | spacedRepetition.test |
| T2 | Third correct review | Normal | Interval = round(previous × EF), and grows | spacedRepetition.test |
| T3 | Wrong answer after progress | Normal | Repetitions reset, interval back to 1 (lapse) | spacedRepetition.test |
| T4 | Repeated failures | Boundary | Easiness never falls below 1.3 | spacedRepetition.test |
| T5 | Quality 6 or −1 | Erroneous | Throws RangeError | spacedRepetition.test |
| T6 | Equal ratings | Normal | Expected score = 0.5 | engine.test |
| T7 | Correct / wrong answer | Normal | Student rating up/down; question opposite | engine.test |
| T8 | Many wrong answers | Boundary | Mastery approaches 0, stays ≥ 0 | engine.test |
| T9 | Weak vs strong topic, else equal | Normal | Weak-topic question ranked first | engine.test |
| T10 | Overdue vs future review | Normal | Overdue question ranked first | engine.test |
| T11 | More candidates than limit | Boundary | Exactly `limit` returned, each with reasons | engine.test |
| T12 | Cosine similarity of basic vectors | Normal/Boundary | 1, 0 and 0 (zero vector) | engine.test |
| T13 | Collaborative recommend | Normal | Suggests linked unseen question, excludes attempted | engine.test |
| T14 | Seed database | Normal | ≥ 5 topics and many questions created | api.test |
| T15 | Correct answer recorded | Normal | `correct=true`, mastery rises, interval ≥ 1 | api.test |
| T16 | Wrong answer recorded | Normal | `correct=false`, next review in 1 day | api.test |
| T17 | Blank answer | Erroneous | Handled, `blank=true`, not counted correct | api.test |
| T18 | Per-topic analytics | Normal | Aggregated attempts and 0–100 accuracy | api.test |
| T19 | Full API flow | Normal | Health, recommend, attempt, analytics succeed; no answer leaked | api.test |
| T20 | Unknown student | Erroneous | API returns 404 | api.test |

| T21 | Password hashing | Normal | Correct password verifies, wrong one fails; salts differ | auth.test |
| T22 | Short password | Erroneous | Rejected | auth.test |
| T23 | Written self-marking | Normal | Full marks pass, zero marks fail; mark scheme returned | api.test |
| T24 | Login + disabled account | Normal/Erroneous | Token resolves to user; disabled user cannot log in | api.test |
| T25 | Edit/tag a question | Normal | Sub-topic and marks update | api.test |
| T26 | Unauthenticated API call | Erroneous | Returns 401 | api.test |
| T27 | Role-based access | Erroneous/Normal | Student gets 403 on content/admin routes; teacher/admin allowed | api.test |
| T28 | Written self-marking over HTTP | Normal | Mark scheme returned after attempt; pass recorded | api.test |

## Manual / user-acceptance checks

| Step | What to do | Expected |
| --- | --- | --- |
| U1 | `npm start`, open the app | Practice tab shows a recommended question with reasons. |
| U2 | Answer several questions wrong in one topic | That topic drops on the dashboard and is recommended more. |
| U3 | Answer many questions correctly | Difficulty/ability rating rises; readiness increases. |
| U4 | Switch to the Dashboard | Mastery bars, accuracy, rating and due count display. |
| U5 | Refresh the page | The same student persists (stored in the browser). |

## How to run a single test file

```bash
node --no-warnings --test test/spacedRepetition.test.js
```
