"use strict";

const BASE = "https://api.amass.tech/api/v1";

class AmassError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "AmassError";
    this.status = status;
  }
}

function stripFulltext(urlString) {
  const u = new URL(urlString);
  const includes = u.searchParams
    .getAll("include")
    .filter((v) => v && v.toLowerCase() !== "fulltext");
  u.searchParams.delete("include");
  for (const inc of includes) u.searchParams.append("include", inc);
  return u.toString();
}

/**
 * GET https://api.amass.tech/api/v1 + path
 * Auth: Authorization: Bearer <apiKey>
 * Unwraps { data }. Never requests fulltext.
 */
async function amassGet(path, apiKey) {
  const rel = String(path || "");
  const joined = `${BASE}${rel.startsWith("/") ? rel : `/${rel}`}`;
  const url = stripFulltext(joined);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  let json;
  try {
    json = await res.json();
  } catch {
    throw new AmassError(`Amass ${res.status}`, res.status);
  }
  if (!res.ok || json.error) {
    const status = (json.error && json.error.status) || res.status;
    const message =
      (json.error && json.error.message) || `Amass ${status}`;
    throw new AmassError(message, status);
  }
  return json.data;
}

/**
 * Search a core. `extra.include` may be a string or array of strings;
 * arrays are sent as repeated `include=` params. `fulltext` is never sent.
 */
async function searchCore(core, query, apiKey, extra = {}, limit = 12) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  for (const [k, v] of Object.entries(extra || {})) {
    if (v == null || k === "include") continue;
    params.set(k, String(v));
  }
  const rawInclude = extra && extra.include;
  const includes = Array.isArray(rawInclude)
    ? rawInclude
    : rawInclude
      ? [rawInclude]
      : [];
  for (const inc of includes) {
    if (inc && String(inc).toLowerCase() !== "fulltext") {
      params.append("include", String(inc));
    }
  }
  const data = await amassGet(
    `/cores/${core}/records?${params.toString()}`,
    apiKey,
  );
  return Array.isArray(data) ? data : [];
}

module.exports = {
  BASE,
  AmassError,
  amassGet,
  searchCore,
};
