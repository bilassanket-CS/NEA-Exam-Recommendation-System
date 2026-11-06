// test/retrieval.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildIndex, search, findRelatedResource } from "../src/engine/retrieval.js";
import { PAST_PAPER_EXCERPTS } from "../src/db/pastPapers.js";

const SAMPLE_CORPUS = [
  { topic: "Data Structures", excerptText: "A stack is LIFO. A queue is FIFO.", sourceTitle: "A", sourceUrl: "http://a" },
  { topic: "Networks", excerptText: "TCP guarantees reliable ordered delivery over a network.", sourceTitle: "B", sourceUrl: "http://b" },
];

test("search ranks the excerpt that shares the most query terms highest", () => {
  const index = buildIndex(SAMPLE_CORPUS);
  const results = search(index, "explain the difference between a stack and a queue");
  assert.equal(results[0].excerpt.sourceTitle, "A");
  assert.ok(results[0].score > results[1].score);
});

test("search restricted to a topic only returns excerpts from that topic", () => {
  const index = buildIndex(SAMPLE_CORPUS);
  const results = search(index, "network", { topic: "Networks" });
  assert.ok(results.every((r) => r.excerpt.topic === "Networks"));
});

test("search falls back to the whole corpus when the requested topic has no excerpts", () => {
  const index = buildIndex(SAMPLE_CORPUS);
  const results = search(index, "stack", { topic: "Nonexistent Topic" });
  assert.ok(results.length > 0);
});

test("a query with no vocabulary overlap at all returns no relevant match", () => {
  const index = buildIndex(SAMPLE_CORPUS);
  const result = findRelatedResource("Data Structures", "zzz qqq xyzzy nonsense", index);
  assert.equal(result, null);
});

// ---- against the real OCR corpus ----
test("the real corpus has at least one excerpt for every seeded topic", () => {
  const topics = ["Data Structures", "Algorithms", "Boolean Logic", "Networks", "Databases & SQL", "Programming Concepts"];
  for (const t of topics) {
    assert.ok(PAST_PAPER_EXCERPTS.some((e) => e.topic === t), `no excerpt for topic "${t}"`);
  }
});

test("every real excerpt has a working-looking OCR source URL", () => {
  for (const e of PAST_PAPER_EXCERPTS) {
    assert.match(e.sourceUrl, /^https:\/\/www\.ocr\.org\.uk\//);
    assert.ok(e.excerptText.length > 20);
    assert.ok(e.sourceTitle.length > 0);
  }
});

test("findRelatedResource picks the hardware excerpt, not the protocols one, for a device question", () => {
  // Regression: the Networks topic has two excerpts (hardware vs. protocols). A
  // "which device routes packets" question must match the hardware excerpt, not
  // just any excerpt tagged with the right topic.
  const result = findRelatedResource("Networks", "Hardware Which device routes packets between multiple networks?");
  assert.ok(result);
  assert.match(result.excerptText, /Router/);
});

test("findRelatedResource finds the stacks/queues excerpt for a matching real question", () => {
  const result = findRelatedResource("Data Structures", "Explain the difference between a stack and a queue, giving one use of each.");
  assert.ok(result);
  assert.match(result.excerptText, /FIFO|LIFO/);
  assert.match(result.sourceUrl, /^https:\/\/www\.ocr\.org\.uk\//);
});
