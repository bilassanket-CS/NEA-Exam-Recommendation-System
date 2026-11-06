// src/engine/retrieval.js
// Stage 4: when a student answers a question wrong, find the most relevant
// real OCR mark-scheme excerpt (src/db/pastPapers.js). A from-scratch TF-IDF
// vector index + cosine similarity search over the small, pre-built corpus —
// no runtime PDF parsing, no external search/embedding service.

import { tokenize } from "./contentFeatures.js";
import { cosineSimilarity } from "./collaborative.js";
import { PAST_PAPER_EXCERPTS } from "../db/pastPapers.js";

const MIN_SIMILARITY = 0.12;

/** Build a TF-IDF index once for a given corpus (pure function, easy to test
 *  against a custom corpus, and reused for the real PAST_PAPER_EXCERPTS). */
export function buildIndex(excerpts) {
  const docsTokens = excerpts.map((e) => tokenize(`${e.topic} ${e.excerptText}`));
  const vocabulary = [...new Set(docsTokens.flat())];
  const vocabIndex = new Map(vocabulary.map((t, i) => [t, i]));

  const df = new Array(vocabulary.length).fill(0);
  for (const tokens of docsTokens) {
    for (const t of new Set(tokens)) df[vocabIndex.get(t)]++;
  }
  const n = excerpts.length;
  const idf = df.map((count) => Math.log((n + 1) / (count + 1)) + 1); // smoothed IDF

  const toTfIdfVector = (tokens) => {
    const tf = new Array(vocabulary.length).fill(0);
    for (const t of tokens) {
      const idx = vocabIndex.get(t);
      if (idx != null) tf[idx] += 1;
    }
    return tf.map((count, i) => count * idf[i]);
  };

  const vectors = docsTokens.map(toTfIdfVector);
  return { excerpts, vocabulary, vocabIndex, idf, vectors, toTfIdfVector };
}

let cachedIndex = null;
function getDefaultIndex() {
  if (!cachedIndex) cachedIndex = buildIndex(PAST_PAPER_EXCERPTS);
  return cachedIndex;
}

/**
 * Search an index for the excerpts most similar to `queryText`, optionally
 * restricted to a single topic first (falling back to the whole corpus if
 * that topic has no excerpts). Returns `{ excerpt, score }[]`, best first.
 */
export function search(index, queryText, { topic, limit = 3 } = {}) {
  const pool = topic && index.excerpts.some((e) => e.topic === topic)
    ? index.excerpts.map((e, i) => ({ excerpt: e, vector: index.vectors[i] })).filter((p) => p.excerpt.topic === topic)
    : index.excerpts.map((e, i) => ({ excerpt: e, vector: index.vectors[i] }));

  const queryVector = index.toTfIdfVector(tokenize(queryText));
  return pool
    .map((p) => ({ excerpt: p.excerpt, score: cosineSimilarity(queryVector, p.vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Best single match for a missed question, or null if nothing is relevant enough. */
export function findRelatedResource(topic, queryText, index = getDefaultIndex()) {
  const [top] = search(index, queryText, { topic, limit: 1 });
  if (!top || top.score < MIN_SIMILARITY) return null;
  return {
    excerptText: top.excerpt.excerptText,
    sourceTitle: top.excerpt.sourceTitle,
    sourceUrl: top.excerpt.sourceUrl,
    score: Math.round(top.score * 1000) / 1000,
  };
}
