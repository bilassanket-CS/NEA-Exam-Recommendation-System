# Test Plan

Testing uses normal, boundary and erroneous data, together with integration tests
through the HTTP API. All automated tests are run with Node's built-in runner
(`npm test`); the suite currently contains 67 passing tests. The descriptions
below are written in the third person: they state what should be done and what
should then be observed, rather than giving instructions.

## Automated test matrix

| # | Area | What is checked | Data type | Expected result | File |
| --- | --- | --- | --- | --- | --- |
| SR1 | Spaced repetition | The first two correct reviews of a question | Normal | The intervals produced are 1 day and then 6 days | spacedRepetition.test.js |
| SR2 | Spaced repetition | A third correct review | Normal | The interval grows to the previous interval multiplied by the easiness factor | spacedRepetition.test.js |
| SR3 | Spaced repetition | A wrong answer after earlier progress | Erroneous | The repetition count resets and the interval returns to 1 day | spacedRepetition.test.js |
| SR4 | Spaced repetition | Repeated failures on one item | Boundary | The easiness factor never falls below 1.3 | spacedRepetition.test.js |
| SR5 | Spaced repetition | A quality score outside 0 to 5 | Erroneous | A RangeError is raised | spacedRepetition.test.js |
| SR6 | Spaced repetition | The mapping from an attempt to a quality score | Normal | Correct, incorrect and blank map to the expected quality values | spacedRepetition.test.js |
| E1 | Elo difficulty | Two equal ratings | Normal | The expected score is 0.5 | engine.test.js |
| E2 | Elo difficulty | A correct and a wrong attempt | Normal | The student rating rises then falls, with the question rating moving oppositely | engine.test.js |
| M1 | Mastery | A correct answer, then many wrong answers | Normal / Boundary | Mastery rises, then approaches 0, always staying within 0 to 1 | engine.test.js |
| M2 | Mastery | The weakest-topic ordering | Normal | Topics are ordered from lowest to highest mastery | engine.test.js |
| M3 | Mastery | The readiness calculation | Normal | The average mastery is returned as a percentage | engine.test.js |
| H1 | Priority queue | A mix of priorities pushed onto the heap | Normal | Values are returned in descending priority order | engine.test.js |
| R1 | Recommender | A weak topic against a strong one, all else equal | Normal | The weak-topic question is ranked first | engine.test.js |
| R2 | Recommender | An overdue review against a future one | Normal | The overdue question is ranked first | engine.test.js |
| R3 | Recommender | More candidates than the requested limit | Boundary | Exactly the limit is returned, each with reasons | engine.test.js |
| C1 | Collaborative filtering | Cosine similarity of basic vectors | Normal / Boundary | The values 1, 0 and 0 (for a zero vector) are returned | engine.test.js |
| C2 | Collaborative filtering | Recommendation from previously wrong answers | Normal | A linked unseen question is suggested and attempted ones are excluded | engine.test.js |
| A1 | Authentication | A password hashed and then verified | Normal | The correct password verifies and a wrong one does not | auth.test.js |
| A2 | Authentication | The same password hashed twice | Normal | The two hashes differ because the salts differ | auth.test.js |
| A3 | Authentication | A very short password | Erroneous | It is rejected | auth.test.js |
| A4 | Authentication | Token generation | Normal | Tokens are unique and non-empty | auth.test.js |
| D1 | Database | The seed routine | Normal | At least 5 topics, at least 15 questions and the demo users are created | api.test.js |
| D2 | Database | A correct objective attempt | Normal | It is marked correct and mastery rises | api.test.js |
| D3 | Database | A wrong objective attempt | Normal | It is marked wrong and the review is scheduled after 1 day | api.test.js |
| D4 | Database | A written question self-marked at full marks | Normal | The marks are recorded and the mark scheme is returned | api.test.js |
| D5 | Database | A written self-mark above the maximum | Erroneous | It is rejected | api.test.js |
| D6 | Database | An objective question whose answer is not among the options | Erroneous | It is rejected when the question is added | api.test.js |
| P1 | HTTP API | A request without a valid token | Erroneous | 401 (authentication required) is returned | api.test.js |
| P2 | HTTP API | The login, recommend, attempt and analytics flow | Normal | The flow succeeds and neither answers nor mark schemes are leaked | api.test.js |
| P3 | HTTP API | A student adding a question | Erroneous | 403 is returned, whereas a teacher succeeds with 201 | api.test.js |
| P4 | HTTP API | A non-admin listing accounts | Erroneous | 403 is returned; an admin can list and disable, and the disabled user can no longer log in | api.test.js |
| P5 | HTTP API | A student reading another student's analytics | Erroneous | 403 (forbidden) is returned | api.test.js |
| P6 | HTTP API | A login with the wrong password | Erroneous | 401 is returned | api.test.js |
| TH1 | Theme | Season boundaries (the Halloween window, month ranges) | Normal / Boundary | Each date resolves to the correct season | theme.test.js |
| TH2 | Theme | `'auto'` vs. a fixed vs. an unknown stored value | Normal / Erroneous | Resolves to the season, the fixed theme, or falls back to crimson | theme.test.js |
| TH3 | Theme | Seasonal banner messages | Normal | Crimson has none; every seasonal theme has one | theme.test.js |
| TH4 | HTTP API | `GET /api/theme` with no changes made | Normal | Defaults to crimson, with no banner message | api.test.js |
| TH5 | HTTP API | `PUT /api/theme` by role | Erroneous / Normal | A student/teacher is forbidden; an admin succeeds and the change persists | api.test.js |
| TH6 | HTTP API | An unknown theme name | Erroneous | 400 is returned | api.test.js |
| ML1 | ML recommender | Gradient descent on a linearly-separable synthetic dataset | Normal | Both classes are classified correctly | mlRecommender.test.js |
| ML2 | ML recommender | Training on an empty dataset | Boundary | A harmless zero-weight model is returned, with no crash | mlRecommender.test.js |
| ML3 | ML recommender | The very first attempt a student ever makes | Boundary | Feature values reflect pure cold-start defaults, confirming no leakage | mlRecommender.test.js |
| ML4 | ML recommender | Attempts replayed into training pairs | Normal | Exactly one training pair is produced per attempt | mlRecommender.test.js |
| ML5 | ML recommender | Attempt count below the training threshold | Boundary | `getOrTrainModel` returns null (cold start) | mlRecommender.test.js |
| ML6 | ML recommender | Attempt count at the training threshold | Normal | A trained, cached model with six weights is returned | mlRecommender.test.js |
| ML7 | ML recommender | `recommendML` during cold start, and once trained | Normal | Cold start matches Stage 1 exactly; once trained, a full ranked list with reasons is returned | mlRecommender.test.js |
| RT1 | Retrieval (TF-IDF) | A query matching one of two sample excerpts | Normal | The matching excerpt is ranked first, with a higher score | retrieval.test.js |
| RT2 | Retrieval (TF-IDF) | A search restricted to one topic | Normal | Only excerpts from that topic are returned | retrieval.test.js |
| RT3 | Retrieval (TF-IDF) | A search for a topic with no excerpts | Boundary | The search falls back to the whole corpus | retrieval.test.js |
| RT4 | Retrieval (TF-IDF) | A query with no vocabulary overlap at all | Erroneous | No match is returned | retrieval.test.js |
| RT5 | Retrieval (TF-IDF) | The real OCR excerpt corpus | Normal | Every seeded topic has at least one excerpt, each with a working-looking OCR source URL | retrieval.test.js |
| RT6 | HTTP API | A wrong answer on the stacks/queues question | Normal | A real OCR excerpt and similar-question ids are returned | api.test.js |
| RT7 | HTTP API | A correct answer | Normal | `relatedResource`/`similarQuestions` are absent | api.test.js |

## Manual and user-acceptance checks

These checks are carried out by an end user (a student and, separately, a teacher).
Each row states what should be done and what should then be observed.

| # | What should be done | Expected result |
| --- | --- | --- |
| U1 | The application should be started with `npm start` and opened in a browser. | The sign-in page is shown. |
| U2 | A demo student account should be signed in to. | The Practice tab shows a recommended question together with the reasons it was chosen. |
| U3 | Several questions in one topic should be answered incorrectly. | That topic falls on the dashboard and is recommended more often. |
| U4 | A number of questions should then be answered correctly. | The ability rating and the readiness figure rise. |
| U5 | A written question should be answered and self-marked against the mark scheme. | The awarded marks are recorded and the question is rescheduled for review. |
| U6 | The teacher account should be signed in to, and a new question added and tagged. | The question appears in the bank and can subsequently be recommended. |
| U7 | The admin account should be signed in to, and a student account disabled. | The disabled student can no longer sign in. |
| U8 | The page should be refreshed. | The signed-in session persists, because the token is stored in the browser. |

Each success criterion in the Success Criteria table maps to one or more of the
tests above, so that the criteria, the tests and the results can be traced together.

## Running a single test file

```bash
node --no-warnings --test test/spacedRepetition.test.js
```
