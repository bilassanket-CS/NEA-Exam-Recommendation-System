// src/auth.js
// Authentication helpers using only Node's built-in crypto (no dependencies).
// Passwords are hashed with scrypt and a per-user random salt; session tokens are
// cryptographically random. This supports feature 13 (authentication & accounts)
// and underpins feature 14 (role-based access control).

import { scryptSync, randomBytes, timingSafeEqual } from "node:crypto";

const KEYLEN = 64;

/** Hash a plaintext password. Returns { hash, salt } (both hex strings). */
export function hashPassword(password) {
  if (typeof password !== "string" || password.length < 4) {
    const e = new Error("password must be at least 4 characters");
    e.status = 400;
    throw e;
  }
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEYLEN).toString("hex");
  return { hash, salt };
}

/** Verify a plaintext password against a stored hash+salt (constant-time). */
export function verifyPassword(password, hash, salt) {
  if (typeof password !== "string" || !hash || !salt) return false;
  const candidate = scryptSync(password, salt, KEYLEN);
  const stored = Buffer.from(hash, "hex");
  if (candidate.length !== stored.length) return false;
  return timingSafeEqual(candidate, stored);
}

/** Create a new opaque session token. */
export function createToken() {
  return randomBytes(24).toString("hex");
}

export const ROLES = ["student", "teacher", "admin"];

/** True if `role` is allowed given a list of permitted roles. */
export function roleAllowed(role, allowed) {
  return allowed.includes(role);
}
