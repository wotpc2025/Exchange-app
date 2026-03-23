import { NextResponse } from "next/server";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { buildRateLimitKey, checkRateLimit } from "@/lib/security.js";

export async function requireSessionOrThrow({ adminOnly = false } = {}) {
  const session = await getAppSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (adminOnly && !requireAdmin(session)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}

export function enforceRateLimit(req, {
  scope,
  userKey,
  limit,
  windowMs,
}) {
  const rate = checkRateLimit({
    key: buildRateLimitKey(req, scope, userKey),
    limit,
    windowMs,
  });

  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests", retryAfterSec: rate.retryAfterSec },
      { status: 429 }
    );
  }

  return null;
}

export async function parseJson(req, fallback = {}) {
  return req.json().catch(() => fallback);
}
