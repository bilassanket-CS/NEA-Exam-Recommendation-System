// test/theme.test.js
import { test } from "node:test";
import assert from "node:assert/strict";

import { seasonForDate, effectiveTheme, seasonalMessage } from "../src/engine/theme.js";

// ---- seasonForDate (UK calendar, matches the Codio PHP reference's season_for_date()) ----
test("23 October resolves to autumn (Halloween window not yet open)", () => {
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 9, 23, 12))), "autumn");
});
test("24 October to 31 October resolves to halloween", () => {
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 9, 24, 12))), "halloween");
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 9, 31, 12))), "halloween");
});
test("any day in December resolves to christmas", () => {
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 11, 1, 12))), "christmas");
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 11, 25, 12))), "christmas");
});
test("March to May resolves to spring", () => {
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 2, 1, 12))), "spring");
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 4, 31, 12))), "spring");
});
test("June to August resolves to summer", () => {
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 5, 1, 12))), "summer");
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 7, 31, 12))), "summer");
});
test("January and February resolve to winter", () => {
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 0, 15, 12))), "winter");
  assert.equal(seasonForDate(new Date(Date.UTC(2026, 1, 15, 12))), "winter");
});

// ---- effectiveTheme ----
test("'auto' resolves to the season for the given date", () => {
  assert.equal(effectiveTheme("auto", new Date(Date.UTC(2026, 9, 25, 12))), "halloween");
});
test("a fixed valid theme is returned as-is", () => {
  assert.equal(effectiveTheme("spring"), "spring");
});
test("an unknown stored value falls back to crimson", () => {
  assert.equal(effectiveTheme("not-a-theme"), "crimson");
});

// ---- seasonalMessage ----
test("crimson (the classic default) has no banner message", () => {
  assert.equal(seasonalMessage("crimson"), "");
});
test("every seasonal theme has a banner message", () => {
  for (const t of ["spring", "summer", "autumn", "winter", "halloween", "christmas"]) {
    assert.ok(seasonalMessage(t).length > 0);
  }
});
