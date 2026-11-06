// src/engine/retrieval.js
// Stage 4: when a student answers a question wrong, find the most relevant
// real OCR mark-scheme excerpt (src/db/pastPapers.js). A from-scratch TF-IDF
// vector index + cosine similarity search over the small, pre-built corpus —
// no runtime PDF parsing, no external search/embedding service.

import { tokenize } from "./contentFeatures.js";
import { cosineSimilarity } from "./collaborative.js";
import { PAST_PAPER_EXCERPTS } from "../db/pastPapers.js";

const MIN_SIMILARITY = 0.12;
// A match resting on one genuinely unique/specific shared term (see below)
// naturally scores lower, since the rest of a longer excerpt dilutes cosine
// similarity — it's still trustworthy at a lower bar than an ordinary match.
const MIN_SIMILARITY_WITH_UNIQUE_TERM = 0.08;
// With such short documents, a single coincidentally-shared generic word
// (e.g. both texts happening to say "code") can push cosine similarity above
// MIN_SIMILARITY on its own. Requiring at least two shared distinctive (3+
// letter) terms screens that out — UNLESS a single shared term is rare
// enough across the corpus (appears in only one document) to be genuinely
// distinctive by itself, e.g. "encapsulation": one such term is as
// trustworthy as two ordinary ones.
const MIN_SHARED_TERMS = 2;
const UNIQUE_TERM_MAX_DOC_COUNT = 1;
const UNIQUE_TERM_MIN_LENGTH = 9;

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
  return { excerpts, vocabulary, vocabIndex, idf, df, vectors, docsTokens, toTfIdfVector };
}

/** How many distinctive (3+ letter) terms two token lists share, and whether
 *  any shared term is rare enough across the whole corpus (df) AND long
 *  enough (9+ letters) to count as distinctive on its own. Length matters
 *  here too: a word can be "rare" in this small corpus purely by chance
 *  (e.g. "pointers"/"methods" each happen to appear in only one excerpt,
 *  despite being ordinary CS vocabulary) — length is a cheap proxy for
 *  "actually a specific technical term" (e.g. "encapsulation"), screening
 *  out that kind of accidental rarity. */
function analyzeOverlap(queryTokens, docTokens, index) {
  const docSet = new Set(docTokens.filter((t) => t.length >= 3));
  const shared = new Set(queryTokens.filter((t) => t.length >= 3 && docSet.has(t)));
  const hasUniqueTerm = [...shared].some((t) => {
    if (t.length < UNIQUE_TERM_MIN_LENGTH) return false;
    const idx = index.vocabIndex.get(t);
    return idx != null && index.df[idx] <= UNIQUE_TERM_MAX_DOC_COUNT;
  });
  return { count: shared.size, hasUniqueTerm };
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
  const all = index.excerpts.map((e, i) => ({ excerpt: e, vector: index.vectors[i], tokens: index.docsTokens[i] }));
  const pool = topic && all.some((p) => p.excerpt.topic === topic) ? all.filter((p) => p.excerpt.topic === topic) : all;

  const queryTokens = tokenize(queryText);
  const queryVector = index.toTfIdfVector(queryTokens);
  return pool
    .map((p) => {
      const overlap = analyzeOverlap(queryTokens, p.tokens, index);
      return { excerpt: p.excerpt, score: cosineSimilarity(queryVector, p.vector),
        sharedTerms: overlap.count, hasUniqueTerm: overlap.hasUniqueTerm };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Best match for a missed question that clears the relevance bar, or null
 *  if nothing does — checked in score order, not just the single top result,
 *  since the highest-scoring candidate can fail the distinctiveness check
 *  (a coincidental generic overlap) while a slightly lower-scoring one with
 *  a genuinely specific shared term passes. */
export function findRelatedResource(topic, queryText, index = getDefaultIndex()) {
  const candidates = search(index, queryText, { topic, limit: 5 });
  const top = candidates.find((c) => c.hasUniqueTerm
    ? c.score >= MIN_SIMILARITY_WITH_UNIQUE_TERM
    : c.score >= MIN_SIMILARITY && c.sharedTerms >= MIN_SHARED_TERMS);
  if (!top) return null;
  return {
    excerptText: top.excerpt.excerptText,
    sourceTitle: top.excerpt.sourceTitle,
    sourceUrl: top.excerpt.sourceUrl,
    score: Math.round(top.score * 1000) / 1000,
  };
}
