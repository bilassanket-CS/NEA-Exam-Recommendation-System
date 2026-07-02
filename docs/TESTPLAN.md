# Test Plan

Testing uses **normal**, **boundary** and **erroneous** data, together with
integration testing through the HTTP API and user-acceptance testing. All
automated tests are run with Node's built-in test runner using `npm test`; at the
time of writing **34 tests pass**. The tables below are written in the third
person: each entry states what is tested, the type of data used, the result that
should be produced, and the file in which the test is automated. Every criterion
is treated as met only if the stated test passes.

## Automated test matrix

| # | What is tested | Data type | Expected result | Automated in |
| --- | --- | --- | --- | --- |
| T1 | SM-2, first two correct reviews | Normal | The interval produced should be 1 day for the first review and 6 days for the second. | spacedRepetition.test.js |
| T2 | SM-2, third correct review | Normal | The interval should equal the previous interval multiplied by the easiness factor, and should increase. | spacedRepetition.test.js |
| T3 | SM-2 lapse (a wrong answer after progress) | Normal | The repetition count and interval should be reset, and the next review should fall after 1 day. | spacedRepetition.test.js |
| T4 | Repeated failures | Boundary | The easiness factor should never fall below 1.3. | spacedRepetition.test.js |
| T5 | An invalid quality value | Erroneous | A range error should be raised. | spacedRepetition.test.js |
| T6 | Elo, equal ratings | Normal | The expected score should be 0.5. | engine.test.js |
| T7 | Elo, a correct and a wrong attempt | Normal | The student rating should rise on a correct answer and fall on a wrong one, and the question rating should move in the opposite direction. | engine.test.js |
| T8 | Mastery bounds | Boundary | The mastery value should move toward 1 on correct answers and toward 0 on wrong ones, and should remain within 0 to 1. | engine.test.js |
| T9 | Weakest-topic ordering | Normal | The topics should be ordered from weakest to strongest. | engine.test.js |
| T10 | Priority queue ordering | Normal | The items should be returned in descending priority order. | engine.test.js |
| T11 | Recommender, weak-topic priority | Normal | A question from the weaker topic should be ranked first, all else being equal. | engine.test.js |
| T12 | Recommender, due-for-review priority | Normal | An overdue question should be ranked ahead of one that is not yet due. | engine.test.js |
| T13 | Recommender, limit and reasons | Boundary | No more than the requested number of questions should be returned, and each should carry at least one reason. | engine.test.js |
| T14 | Collaborative filtering | Normal | Unseen questions linked to wrongly answered ones should be suggested, and already-attempted questions should be excluded. | engine.test.js |
| T15 | Password hashing and verification | Normal | A password should verify against its own hash and should be rejected against a wrong one. | auth.test.js |
| T16 | Password salting | Boundary | The same password hashed twice should produce two different hashes. | auth.test.js |
| T17 | A password that is too short | Erroneous | An error should be raised. | auth.test.js |
| T18 | Seeding of the database | Normal | At least five topics, fifteen questions and the three demo accounts should be created. | api.test.js |
| T19 | Objective auto-marking | Normal | A correct answer should be marked correct and the topic mastery should rise. | api.test.js |
| T20 | A wrong objective answer | Normal | The answer should be marked incorrect and the question should be scheduled for review after 1 day. | api.test.js |
| T21 | Written self-marking | Normal | The self-awarded marks should be recorded, the mark scheme should be returned, and the same mastery, spaced-repetition and difficulty models should be updated as for objective questions. | api.test.js |
| T22 | A written mark outside the valid range | Erroneous | The submission should be rejected. | api.test.js |
| T23 | An objective answer that is not one of the options | Erroneous | Adding the question should be rejected. | api.test.js |
| T24 | An unauthenticated request | Erroneous | The request should be rejected with status 401. | api.test.js |
| T25 | The full authenticated flow | Normal | Login, recommendation, attempt and analytics should all succeed, and neither the answer nor the mark scheme should appear in the recommendations. | api.test.js |
| T26 | Role enforcement for content | Erroneous / Normal | A student should be refused when adding a question (403), while a teacher should be allowed to add one (201). | api.test.js |
| T27 | Account management restricted to admins | Erroneous / Normal | A teacher should be refused the user list (403); an admin should be able to list and disable accounts; and a disabled account should no longer be able to log in. | api.test.js |
| T28 | Ownership of data | Erroneous | A student should be refused access to another student's analytics (403). | api.test.js |
| T29 | An incorrect password | Erroneous | Login should be rejected with status 401. | api.test.js |

These automated tests map onto the fifteen success criteria: T1–T5 cover spaced
repetition (criterion 6), T6–T7 cover difficulty (criterion 5), T8 covers mastery
(criterion 4), T11–T14 cover the recommender and explainability (criteria 7 and 8),
T15–T17 and T24–T25 cover authentication (criterion 13), T19–T23 cover marking and
validation (criteria 2, 3 and 15), and T26–T28 cover role-based access and ownership
(criterion 14).

## Manual / user-acceptance testing

| # | Procedure | Expected result |
| --- | --- | --- |
| U1 | The application should be started with `npm start`, opened in a browser, and signed into with the demo student account. | The practice screen should appear, showing a recommended question together with the reasons for its selection. |
| U2 | Several questions in a single topic should be answered incorrectly. | That topic should fall on the dashboard and should then be recommended more often. |
| U3 | A series of questions should be answered correctly. | The ability rating and the readiness figure should both rise. |
| U4 | The dashboard should be opened. | The mastery bars, accuracy, ability rating and due count should be displayed. |
| U5 | A written question should be answered and self-marked against the mark scheme. | The awarded marks should be recorded and the next review should be scheduled. |
| U6 | The teacher and admin accounts should be signed into in turn. | The teacher should be able to add and edit questions; the admin should additionally be able to manage accounts; and a student should have neither ability. |
| U7 | The page should be refreshed after signing in. | The session should persist, so that the same user remains signed in. |

## Running the tests

The full suite is run with:

```bash
npm test
```

A single file can be run with:

```bash
node --no-warnings --test test/spacedRepetition.test.js
```
