import "server-only";
import { randomUUID } from "crypto";
import net from "net";
import { ensureSchema, getPool } from "./db.js";

const DEFAULT_TTL_DAYS = 7;
const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "gclid",
  "fbclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "ref"
];

export function getCacheConfig() {
  const ttlRaw = process.env.CACHE_TTL_DAYS;
  const ttlDays = Number.parseInt(ttlRaw, 10);

  return {
    ttlDays: Number.isFinite(ttlDays) && ttlDays > 0 ? ttlDays : DEFAULT_TTL_DAYS
  };
}

export function normalizeUrlKey(inputUrl) {
  if (!inputUrl) {
    return null;
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`);
  } catch (error) {
    return null;
  }

  url.hash = "";
  url.username = "";
  url.password = "";

  const hostname = url.hostname.toLowerCase();
  const hostKey = hostname.startsWith("www.") ? hostname.slice(4) : hostname;

  const params = new URLSearchParams(url.search);
  for (const key of TRACKING_PARAMS) {
    params.delete(key);
  }

  const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
  const normalizedParams = new URLSearchParams(entries);

  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  const query = normalizedParams.toString();

  return `${hostKey}${pathname}${query ? `?${query}` : ""}`;
}

export function buildCacheKeyCandidates(inputUrl) {
  if (!inputUrl) {
    return [];
  }

  const trimmed = inputUrl.trim();
  const candidates = new Set();

  const baseKey = normalizeUrlKey(trimmed);
  if (baseKey) {
    candidates.add(baseKey);
  }

  let url;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch (error) {
    return Array.from(candidates);
  }

  const host = url.hostname;
  const isIpHost = net.isIP(host) > 0 || host.includes(":");
  const altHost =
    !isIpHost && host !== "localhost"
      ? host.startsWith("www.")
        ? host.slice(4)
        : `www.${host}`
      : null;

  const protocols = [url.protocol];
  const altProtocol = url.protocol === "https:" ? "http:" : "https:";
  if (!protocols.includes(altProtocol)) {
    protocols.push(altProtocol);
  }

  const hosts = altHost && altHost !== host ? [host, altHost] : [host];

  for (const protocol of protocols) {
    for (const hostname of hosts) {
      const candidate = new URL(url.toString());
      candidate.protocol = protocol;
      candidate.hostname = hostname;
      const key = normalizeUrlKey(candidate.toString());
      if (key) {
        candidates.add(key);
      }
    }
  }

  return Array.from(candidates);
}

async function safeQuery(fn) {
  try {
    return await fn();
  } catch (error) {
    console.warn("Cache query failed:", error.message);
    return null;
  }
}

export async function getCachedResult(urlKey) {
  if (!urlKey) {
    return null;
  }

  const pool = getPool();
  if (!pool) {
    return null;
  }

  return safeQuery(async () => {
    await ensureSchema();
    const { ttlDays } = getCacheConfig();
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `SELECT id, url, analysis, context, sources, created_at
       FROM company_results
       WHERE url_key = $1 AND created_at >= $2
       LIMIT 1`,
      [urlKey, cutoff]
    );

    return result.rows[0] || null;
  });
}

export async function getCachedResultForUrl(inputUrl) {
  const keys = buildCacheKeyCandidates(inputUrl);
  if (!keys.length) {
    return null;
  }

  const pool = getPool();
  if (!pool) {
    return null;
  }

  return safeQuery(async () => {
    await ensureSchema();
    const { ttlDays } = getCacheConfig();
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `SELECT id, url, analysis, context, sources, created_at
       FROM company_results
       WHERE url_key = ANY($1) AND created_at >= $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [keys, cutoff]
    );

    return result.rows[0] || null;
  });
}

export async function storeResult({ url, urlKey, analysis, context, sources }) {
  const pool = getPool();
  if (!pool || !urlKey) {
    return null;
  }

  return safeQuery(async () => {
    await ensureSchema();
    const analysisValue = JSON.stringify(analysis || {});
    const sourcesValue = JSON.stringify(sources || []);
    const id = randomUUID();
    const result = await pool.query(
      `INSERT INTO company_results (id, url, url_key, analysis, context, sources, created_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6::jsonb, NOW())
       ON CONFLICT (url_key)
       DO UPDATE SET url = $2, analysis = $4::jsonb, context = $5, sources = $6::jsonb, created_at = NOW()
       RETURNING id, url, analysis, context, sources, created_at`,
      [id, url, urlKey, analysisValue, context || "", sourcesValue]
    );

    return result.rows[0] || null;
  });
}

export async function getShareResult(id) {
  if (!id) {
    return null;
  }

  const pool = getPool();
  if (!pool) {
    return null;
  }

  return safeQuery(async () => {
    await ensureSchema();
    const { ttlDays } = getCacheConfig();
    const cutoff = new Date(Date.now() - ttlDays * 24 * 60 * 60 * 1000);
    const result = await pool.query(
      `SELECT id, url, analysis, context, sources, created_at
       FROM company_results
       WHERE id = $1 AND created_at >= $2
       LIMIT 1`,
      [id, cutoff]
    );

    return result.rows[0] || null;
  });
}
