// src/engine/spacedRepetition.js
// SM-2 spaced-repetition algorithm (SuperMemo 2).
// Decides WHEN a question should next be reviewed, based on how well it was answered.
//
// A "quality" score q (0..5) describes the answer:
//   5 = correct and fast/confident, 4 = correct, 3 = correct but hard,
//   2 = wrong (familiar), 1 = wrong, 0 = blank / no idea.
// State per (student, question): repetitions, interval (days), easiness factor (EF).

export const MIN_EASINESS = 1.3;

/** Map an attempt to an SM-2 quality score (0..5). Deterministic for testing. */
export function qualityFromAttempt({ correct, blank = false, fast = false }) {
  if (blank) return 0;
  if (!correct) return 2;
  return fast ? 5 : 4;
}

/**
 * Run one SM-2 update.
 * @param {{repetitions:number, interval:number, easiness:number}} state previous schedule
 * @param {number} quality 0..5
 * @returns {{repetitions:number, interval:number, easiness:number}} next schedule
 */
export function sm2(state, quality) {
  if (!Number.isInteger(quality) || quality < 0 || quality > 5) {
    throw new RangeError(`quality must be an integer 0..5, got ${quality}`);
  }
  let { repetitions, interval, easiness } = state;

  // Update easiness factor first (applies whether right or wrong).
  easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (easiness < MIN_EASINESS) easiness = MIN_EASINESS;

  if (quality < 3) {
    // Lapse: the card was not recalled well — restart the repetition cycle.
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easiness);
    repetitions += 1;
  }
  return { repetitions, interval, easiness: round2(easiness) };
}

/** Convenience wrapper returning the next due date as well. */
export function schedule(state, quality, now = Date.now()) {
  const next = sm2(state, quality);
  const dueDate = now + next.interval * 24 * 60 * 60 * 1000;
  return { ...next, dueDate };
}

/** A fresh schedule for a question never seen before. */
export function initialSchedule() {
  return { repetitions: 0, interval: 0, easiness: 2.5 };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
