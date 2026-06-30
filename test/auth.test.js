// test/auth.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword, newToken } from "../src/engine/auth.js";

test("hashPassword + verifyPassword round-trip", () => {
  const { hash, salt } = hashPassword("secret123");
  assert.ok(hash.length > 0 && salt.length > 0);
  assert.equal(verifyPassword("secret123", hash, salt), true);
  assert.equal(verifyPassword("wrong", hash, salt), false);
});

test("the same password with different salts gives different hashes", () => {
  const a = hashPassword("secret123");
  const b = hashPassword("secret123");
  assert.notEqual(a.hash, b.hash);
});

test("short passwords are rejected", () => {
  assert.throws(() => hashPassword("ab"));
});

test("tokens are unique-ish and non-empty", () => {
  assert.notEqual(newToken(), newToken());
  assert.ok(newToken().length >= 32);
});
