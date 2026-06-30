// src/server.js
// Zero-dependency HTTP server. Serves the static front end and a JSON API with
// token-based authentication and role-based access control.

import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, extname, normalize } from "node:path";
import { existsSync } from "node:fs";

import { Database } from "./db/database.js";
import { seed } from "./db/seed.js";
import * as h from "./api/handlers.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, "..", "public");
const MIME = { ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml" };

// Endpoints that do NOT require a valid session token.
const PUBLIC_API = new Set(["GET /api/health", "POST /api/auth/register", "POST /api/auth/login"]);

export function createServer(database) {
  let db = database;
  if (!db) {
    db = new Database(process.env.DB_FILE || ":memory:");
    if (db.getTopics().length === 0) seed(db);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const { pathname, searchParams } = url;

      if (pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        const route = `${req.method} ${pathname}`;

        // Authenticate (except for public endpoints).
        const token = bearer(req);
        const user = token ? db.getSessionUser(token) : null;
        const isPublic = PUBLIC_API.has(route);
        if (!isPublic && !user) return send(res, 401, { error: "authentication required" });

        // ---- auth ----
        if (route === "GET /api/health") return send(res, 200, { ok: true });
        if (route === "POST /api/auth/register") return send(res, 201, h.register(db, await readJson(req)));
        if (route === "POST /api/auth/login") return send(res, 200, h.login(db, await readJson(req)));
        if (route === "GET /api/auth/me") return send(res, 200, h.me(db, user));

        // ---- reference ----
        if (route === "GET /api/topics") return send(res, 200, h.getTopics(db));

        // ---- practice / analytics ----
        if (req.method === "GET" && pathname === "/api/recommendations") {
          return send(res, 200, h.getRecommendations(db, {
            studentId: Number(searchParams.get("studentId")) || user.id,
            limit: Number(searchParams.get("limit") || 5),
          }, user));
        }
        if (route === "POST /api/attempts") {
          const body = await readJson(req);
          if (body.studentId == null) body.studentId = user.id;
          return send(res, 200, h.submitAttempt(db, body, user));
        }
        if (req.method === "GET" && pathname === "/api/analytics") {
          return send(res, 200, h.getAnalytics(db, {
            studentId: Number(searchParams.get("studentId")) || user.id,
          }, user));
        }

        // ---- content management (teacher/admin) ----
        if (route === "POST /api/questions") return send(res, 201, h.addQuestion(db, await readJson(req), user));
        if (route === "GET /api/questions") return send(res, 200, h.listQuestions(db, user));
        const qMatch = pathname.match(/^\/api\/questions\/(\d+)$/);
        if (req.method === "PUT" && qMatch) {
          return send(res, 200, h.updateQuestion(db, Number(qMatch[1]), await readJson(req), user));
        }

        // ---- account management (admin) ----
        if (route === "GET /api/users") return send(res, 200, h.listUsers(db, user));
        if (route === "POST /api/users") return send(res, 201, h.createUser(db, await readJson(req), user));
        const dMatch = pathname.match(/^\/api\/users\/(\d+)\/(disable|enable)$/);
        if (req.method === "POST" && dMatch) {
          return send(res, 200, h.setUserActive(db, Number(dMatch[1]), dMatch[2] === "enable", user));
        }

        return send(res, 404, { error: "not found" });
      }

      await serveStatic(req, res, pathname);
    } catch (e) {
      send(res, e.status || 500, { error: e.message || "server error" });
    }
  });

  server.db = db;
  return server;
}

function bearer(req) {
  const a = req.headers["authorization"] || "";
  return a.startsWith("Bearer ") ? a.slice(7).trim() : null;
}
function send(res, status, obj) {
  res.statusCode = status;
  if (!res.getHeader("Content-Type")) res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(obj));
}
async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try { return JSON.parse(raw); }
  catch { const e = new Error("invalid JSON body"); e.status = 400; throw e; }
}
async function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "/index.html" : pathname;
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.statusCode = 404; res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  }
  const data = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[extname(filePath)] || "application/octet-stream");
  res.end(data);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = process.env.PORT || 3000;
  createServer().listen(port, () => {
    console.log(`Exam Question Recommendation System running at http://localhost:${port}`);
    console.log("Demo logins: student@example.com/student123, teacher@example.com/teacher123, admin@example.com/admin123");
  });
}
