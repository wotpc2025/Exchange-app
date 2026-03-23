const globalBuckets = globalThis.__exchangeRateLimitBuckets || new Map();
globalThis.__exchangeRateLimitBuckets = globalBuckets;

function cleanupExpired(now) {
  for (const [key, entry] of globalBuckets.entries()) {
    if (!entry || entry.resetAt <= now) {
      globalBuckets.delete(key);
    }
  }
}

export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip") || "unknown";
}

export function buildRateLimitKey(req, scope = "global", userKey = null) {
  const ip = getClientIp(req);
  return `${scope}:${userKey || "anon"}:${ip}`;
}

export function checkRateLimit({ key, limit, windowMs }) {
  const now = Date.now();
  cleanupExpired(now);

  const current = globalBuckets.get(key);
  if (!current || current.resetAt <= now) {
    globalBuckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    return { ok: true, remaining: Math.max(limit - 1, 0), retryAfterSec: 0 };
  }

  if (current.count >= limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.ceil((current.resetAt - now) / 1000),
    };
  }

  current.count += 1;
  globalBuckets.set(key, current);
  return { ok: true, remaining: Math.max(limit - current.count, 0), retryAfterSec: 0 };
}

export function sanitizeText(value, { maxLen = 1000, allowNewlines = true } = {}) {
  const text = typeof value === "string" ? value : "";
  const normalized = allowNewlines
    ? text.replace(/\r\n/g, "\n")
    : text.replace(/[\r\n]+/g, " ");
  const withoutControl = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");
  const trimmed = withoutControl.trim();
  return trimmed.slice(0, maxLen);
}

export function sanitizeUrl(value, { maxLen = 1000 } = {}) {
  const raw = sanitizeText(value, { maxLen, allowNewlines: false });
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString().slice(0, maxLen);
  } catch {
    return null;
  }
}
