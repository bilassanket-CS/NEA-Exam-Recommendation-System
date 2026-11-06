// src/engine/contentFeatures.js
// Content-based filtering (Stage 2): how similar is a candidate question's text
// to the questions a student has recently got wrong? A simple from-scratch
// bag-of-words vector + cosine similarity (reusing cosineSimilarity from
// collaborative.js rather than reimplementing it).

import { cosineSimilarity } from "./collaborative.js";

// Common English filler words, excluded so two texts that only share "the",
// "is", "which" etc. don't register as meaningfully similar — without this,
// short exam-question prompts can look deceptively close to an unrelated
// excerpt just because of shared grammar, not shared subject matter.
const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "has", "have", "had",
  "he", "in", "is", "it", "its", "of", "on", "or", "that", "the", "to", "was", "were",
  "will", "with", "which", "what", "who", "whom", "this", "these", "those", "do", "does",
  "did", "i", "you", "your", "we", "they", "them", "their", "if", "but", "not", "no",
  "can", "could", "would", "should", "each", "one", "all", "any", "about", "between",
  "into", "than", "then", "there", "where", "when", "why", "how", "mark", "marks",
  // Generic exam/programming boilerplate that recurs across many unrelated
  // excerpts (e.g. "code" appears in almost every programming-related mark
  // scheme) and so isn't actually discriminative between topics.
  "code", "times", "question", "answer", "guidance",
]);

export function tokenize(text) {
  const all = String(text || "").toLowerCase().match(/[a-z0-9]+/g) || [];
  return all.filter((t) => !STOPWORDS.has(t));
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
