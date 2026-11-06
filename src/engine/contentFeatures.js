// src/engine/contentFeatures.js
// Content-based filtering (Stage 2): how similar is a candidate question's text
// to the questions a student has recently got wrong? A simple from-scratch
// bag-of-words vector + cosine similarity (reusing cosineSimilarity from
// collaborative.js rather than reimplementing it).

import { cosineSimilarity } from "./collaborative.js";

export function tokenize(text) {
  return String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
}

/**
 * Average cosine similarity between `text` and each of `priorTexts`, using a
 * local bag-of-words vocabulary built from just the texts being compared.
 * Bounded to [0,1] (all vector entries are non-negative counts). Returns 0 if
 * there is nothing to compare against.
 */
export function subTopicSimilarity(text, priorTexts) {
  if (!priorTexts || priorTexts.length === 0) return 0;
  const targetTokens = tokenize(text);
  const priorTokenLists = priorTexts.map(tokenize);
  const vocabulary = [...new Set([targetTokens, ...priorTokenLists].flat())];
  if (vocabulary.length === 0) return 0;

  const toVector = (tokens) => {
    const vec = new Array(vocabulary.length).fill(0);
    for (const t of tokens) {
      const idx = vocabulary.indexOf(t);
      if (idx !== -1) vec[idx] += 1;
    }
    return vec;
  };

  const targetVec = toVector(targetTokens);
  const sims = priorTokenLists.map((tokens) => cosineSimilarity(targetVec, toVector(tokens)));
  return sims.reduce((s, v) => s + v, 0) / sims.length;
}
