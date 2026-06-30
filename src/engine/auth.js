// src/engine/auth.js
// Authentication helpers using Node's built-in crypto (no dependencies).
// Passwords are hashed with scrypt and a per-user random salt; verification is
// constant-time. Session tokens are random 192-bit hex strings.

import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/** Hash a password. Returns { hash, salt } (both hex strings). */
export function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  if (!password || String(password).length < 4) {
    throw new Error("password must be at least 4 characters");
  }
  const hash = scryptSync(String(password), salt, 64).toString("hex");
  return { hash, salt };
}

/** Constant-time check of a password against a stored hash + salt. */
export function verifyPassword(password, hash, salt) {
  if (!password || !hash || !salt) return false;
  const candidate = scryptSync(String(password), salt, 64);
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && timingSafeEqual(candidate, stored);
}

/** A random session token. */
export function newToken() {
  return randomBytes(24).toString("hex");
}
