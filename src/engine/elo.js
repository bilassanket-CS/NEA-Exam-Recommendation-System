// src/engine/elo.js
// Elo-style difficulty modelling.
// Both the STUDENT and each QUESTION hold a rating. When a student answers a
// question, the ratings update like players after a match: a correct answer is a
// "win" for the student, a wrong answer is a "win" for the question. Over time a
// student's rating reflects their ability and a question's rating reflects its
// difficulty, with no manual labelling required.

export const DEFAULT_RATING = 1200;
export const DEFAULT_K = 24;

/** Expected probability that ratingA beats ratingB. */
export function expectedScore(ratingA, ratingB) {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/**
 * Update student and question ratings after one attempt.
 * @param {number} studentRating
 * @param {number} questionRating
 * @param {boolean} correct  did the student answer correctly?
 * @param {number} k         sensitivity (higher = bigger swings)
 * @returns {{studentRating:number, questionRating:number}}
 */
export function updateRatings(studentRating, questionRating, correct, k = DEFAULT_K) {
  const studentScore = correct ? 1 : 0;
  const expectedStudent = expectedScore(studentRating, questionRating);
  const newStudent = studentRating + k * (studentScore - expectedStudent);
  // The question's outcome is the mirror image of the student's.
  const newQuestion = questionRating + k * ((1 - studentScore) - (1 - expectedStudent));
  return {
    studentRating: Math.round(newStudent),
    questionRating: Math.round(newQuestion),
  };
}
