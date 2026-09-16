"use strict";

const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = process.cwd();
const AMASS_HOST = "api.amass.tech";
const AMASS_PREFIX = "/api/v1";
const AF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, chemical/x-pdb, */*",
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
};

loadEnv(path.join(ROOT, ".env"));

const PORT = Number(process.env.PORT) || 3000;

function loadEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return;
    throw err;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    if (!key || process.env[key] !== undefined) continue;
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
}

function requireLib(rel) {
  try {
    return require(rel);
  } catch (err) {
    const name = rel.replace(/^\.\//, "");
    const msg =
      err.code === "MODULE_NOT_FOUND"
        ? `${name} is missing — another agent must provide it`
        : `failed to load ${name}: ${err.message}`;
    const e = new Error(msg);
    e.status = 500;
    throw e;
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > 1e6) {
        const err = new Error("body too large");
        err.status = 413;
        reject(err);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8").trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        const err = new Error("invalid JSON");
        err.status = 400;
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function httpsGet(urlStr, headers) {
  return new Promise((resolve, reject) => {
    const u = new URL(urlStr);
    const req = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method: "GET",
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 502,
            headers: res.headers,
            body: Buffer.concat(chunks),
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

function isEnvFile(rel) {
  const base = path.basename(rel);
  return base === ".env" || base.startsWith(".env.");
}

function serveStatic(res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === "/") rel = "/index.html";
  if (rel.includes("\0") || rel.split("/").includes("..")) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  rel = rel.replace(/^\/+/, "");
  if (isEnvFile(rel)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  const filePath = path.normalize(path.join(ROOT, rel));
  const rootWithSep = ROOT.endsWith(path.sep) ? ROOT : ROOT + path.sep;
  if (filePath !== ROOT && !filePath.startsWith(rootWithSep)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }
  fs.stat(filePath, (statErr, st) => {
    if (statErr || !st.isFile()) {
      sendJson(res, 404, { error: "not found" });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || "application/octet-stream";
    res.writeHead(200, { "content-type": type });
    fs.createReadStream(filePath).pipe(res);
  });
}

function proxyAmass(res, restPath, search) {
  const key = process.env.AMASS_API_KEY;
  if (!key) {
    sendJson(res, 503, { error: "AMASS_API_KEY is not set" });
    return;
  }
  const destPath = AMASS_PREFIX + (restPath || "/") + (search || "");
  const req = https.request(
    {
      hostname: AMASS_HOST,
      path: destPath,
      method: "GET",
      headers: {
        Authorization: "Bearer " + key,
        Accept: "application/json",
      },
    },
    (up) => {
      const headers = {};
      const ct = up.headers["content-type"];
      if (ct) headers["content-type"] = ct;
      res.writeHead(up.statusCode || 502, headers);
      up.pipe(res);
    },
  );
  req.on("error", (err) => {
    if (!res.headersSent) sendJson(res, 502, { error: err.message || "amass_proxy_failed" });
  });
  req.end();
}

async function handlePdb(res, uniprotRaw) {
  const id = String(uniprotRaw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (!id) {
    sendJson(res, 400, { error: "bad id" });
    return;
  }
  const metaRes = await httpsGet(
    "https://alphafold.ebi.ac.uk/api/prediction/" + id,
    AF_HEADERS,
  );
  if (metaRes.status < 200 || metaRes.status >= 300) {
    sendJson(res, 404, { error: "alphafold_miss", uniprot: id });
    return;
  }
  let meta;
  try {
    meta = JSON.parse(metaRes.body.toString("utf8"));
  } catch {
    sendJson(res, 404, { error: "alphafold_miss", uniprot: id });
    return;
  }
  const pdbUrl = Array.isArray(meta) ? meta[0] && meta[0].pdbUrl : meta && meta.pdbUrl;
  if (!pdbUrl) {
    sendJson(res, 404, { error: "alphafold_no_pdb", uniprot: id });
    return;
  }
  const pdbRes = await httpsGet(pdbUrl, AF_HEADERS);
  if (pdbRes.status < 200 || pdbRes.status >= 300) {
    sendJson(res, 502, { error: "alphafold_pdb_fetch", uniprot: id });
    return;
  }
  res.writeHead(200, {
    "content-type": "chemical/x-pdb",
    "cache-control": "public, max-age=86400",
  });
  res.end(pdbRes.body);
}

async function handleDemo(res) {
  const golden = requireLib("./lib/golden-path");
  sendJson(res, 200, {
    topic: golden.GOLDEN_TOPIC,
    question: golden.GOLDEN_DEMO_QUESTION,
    notesExample: golden.GOLDEN_NOTES_EXAMPLE,
    hasAmass: Boolean(process.env.AMASS_API_KEY),
    hasClaude: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

async function handleLearn(req, res) {
  const body = await readJson(req);
  const topic = String(body.topic || "").trim();
  if (!topic) {
    sendJson(res, 400, { error: "topic required" });
    return;
  }
  const { learnTopic } = requireLib("./lib/learn");
  if (typeof learnTopic !== "function") {
    sendJson(res, 500, { error: "lib/learn.js must export learnTopic" });
    return;
  }
  const result = await learnTopic(topic, process.env.AMASS_API_KEY, Boolean(body.forceLive));
  sendJson(res, 200, result);
}

async function handleTeach(req, res) {
  const body = await readJson(req);
  const question = String(body.question || "").trim();
  const milestones = body.milestones || [];
  if (!question || !Array.isArray(milestones) || milestones.length === 0) {
    sendJson(res, 400, { error: "question and milestones required" });
    return;
  }
  const { teachQuestion } = requireLib("./lib/grounding");
  if (typeof teachQuestion !== "function") {
    sendJson(res, 500, { error: "lib/grounding.js must export teachQuestion" });
    return;
  }
  const result = await teachQuestion(question, milestones, process.env.ANTHROPIC_API_KEY);
  sendJson(res, 200, result);
}

async function handleCheck(req, res) {
  const body = await readJson(req);
  const notes = String(body.notes || "").trim();
  const milestones = body.milestones || [];
  if (!notes || !Array.isArray(milestones) || milestones.length === 0) {
    sendJson(res, 400, { error: "notes and milestones required" });
    return;
  }
  const { checkNotes } = requireLib("./lib/grounding");
  if (typeof checkNotes !== "function") {
    sendJson(res, 500, { error: "lib/grounding.js must export checkNotes" });
    return;
  }
  const result = await checkNotes(notes, milestones, process.env.ANTHROPIC_API_KEY);
  sendJson(res, 200, result);
}

function method(req, res, allowed) {
  if (req.method === allowed) return true;
  sendJson(res, 405, { error: "method not allowed" });
  return false;
}

async function handle(req, res) {
  const u = new URL(req.url || "/", "http://" + (req.headers.host || "localhost"));
  const pathname = u.pathname;

  if (pathname === "/api/amass" || pathname.startsWith("/api/amass/")) {
    if (!method(req, res, "GET")) return;
    const rest = pathname.slice("/api/amass".length) || "/";
    proxyAmass(res, rest, u.search);
    return;
  }

  const pdbMatch = pathname.match(/^\/api\/pdb\/([^/]+)$/);
  if (pdbMatch) {
    if (!method(req, res, "GET")) return;
    await handlePdb(res, pdbMatch[1]);
    return;
  }

  if (pathname === "/api/demo") {
    if (!method(req, res, "GET")) return;
    await handleDemo(res);
    return;
  }
  if (pathname === "/api/learn") {
    if (!method(req, res, "POST")) return;
    await handleLearn(req, res);
    return;
  }
  if (pathname === "/api/teach") {
    if (!method(req, res, "POST")) return;
    await handleTeach(req, res);
    return;
  }
  if (pathname === "/api/check") {
    if (!method(req, res, "POST")) return;
    await handleCheck(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { error: "method not allowed" });
    return;
  }
  serveStatic(res, pathname);
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((err) => {
    if (res.headersSent) return;
    sendJson(res, err.status || 500, { error: err.message || "internal error" });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("CiteLine listening on http://0.0.0.0:" + PORT);
});
