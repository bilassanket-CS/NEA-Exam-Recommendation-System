'use strict'

export function selfMarkWrittenAnswer(studentAnswer, markScheme) {
  const cleanAnswer = String(studentAnswer ?? '').trim().toLowerCase();
  const parts = String(markScheme ?? '')
    .split('|')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (!parts.length) {
    return { correct: false, score: 0, feedback: 'No mark scheme supplied.' };
  }

  const matched = parts.filter((part) => cleanAnswer.includes(part));
  const correct = matched.length === parts.length;
  return {
    correct,
    score: correct ? 1 : 0,
    feedback: correct
      ? 'Well done. Your answer matches the expected points.'
      : 'Some required points are missing; review the mark scheme and try again.',
    matched,
  };
}
