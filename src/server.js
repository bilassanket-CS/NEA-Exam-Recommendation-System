// src/server.js
// Zero-dependency HTTP server using Node's built-in http module. Serves the
// static front end from /public and a small JSON API backed by the Database.

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

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

/** Build a server. Pass a Database in tests; otherwise one is created + seeded. */
export function createServer(database) {
  let db = database;
  if (!db) {
    const location = process.env.DB_FILE || ":memory:";
    db = new Database(location);
    // Seed only if empty (fresh memory DB or new file).
    if (db.getTopics().length === 0) seed(db);
  }

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
      const { pathname, searchParams } = url;

      // ---- API routes ----
      if (pathname.startsWith("/api/")) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");

        if (req.method === "GET" && pathname === "/api/health") {
          return send(res, 200, { ok: true });
        }
        if (req.method === "GET" && pathname === "/api/topics") {
          return send(res, 200, h.getTopics(db));
        }
        if (req.method === "POST" && pathname === "/api/students") {
          const body = await readJson(req);
          return send(res, 201, h.createStudent(db, body));
        }
        const studentMatch = pathname.match(/^\/api\/students\/(\d+)$/);
        if (req.method === "GET" && studentMatch) {
          return send(res, 200, h.getStudent(db, Number(studentMatch[1])));
        }
        if (req.method === "GET" && pathname === "/api/recommendations") {
          const studentId = Number(searchParams.get("studentId"));
          const limit = Number(searchParams.get("limit") || 5);
          return send(res, 200, h.getRecommendations(db, { studentId, limit }));
        }
        if (req.method === "POST" && pathname === "/api/attempts") {
          const body = await readJson(req);
          return send(res, 200, h.submitAttempt(db, body));
        }
        if (req.method === "GET" && pathname === "/api/analytics") {
          const studentId = Number(searchParams.get("studentId"));
          return send(res, 200, h.getAnalytics(db, { studentId }));
        }
        if (req.method === "POST" && pathname === "/api/questions") {
          const body = await readJson(req);
          return send(res, 201, h.addQuestion(db, body));
        }
        return send(res, 404, { error: "not found" });
      }

      // ---- static files ----
      await serveStatic(req, res, pathname);
    } catch (err) {
      const status = err.status || 500;
      send(res, status, { error: err.message || "server error" });
    }
  });

  server.db = db;
  return server;
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
  try {
    return JSON.parse(raw);
  } catch {
    const e = new Error("invalid JSON body");
    e.status = 400;
    throw e;
  }
}

async function serveStatic(req, res, pathname) {
  let rel = pathname === "/" ? "/index.html" : pathname;
  // Prevent path traversal.
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(PUBLIC_DIR, safe);
  if (!filePath.startsWith(PUBLIC_DIR) || !existsSync(filePath)) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  }
  const data = await readFile(filePath);
  res.statusCode = 200;
  res.setHeader("Content-Type", MIME[extname(filePath)] || "application/octet-stream");
  res.end(data);
}

// Start when run directly (node src/server.js).
if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const port = process.env.PORT || 3000;
  const server = createServer();
  server.listen(port, () => {
    console.log(`Exam Question Recommendation System running at http://localhost:${port}`);
  });
}
