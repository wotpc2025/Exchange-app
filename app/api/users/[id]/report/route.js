import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { sanitizeText, sanitizeUrl } from "@/lib/security.js";
import { enforceRateLimit, parseJson, requireSessionOrThrow } from "@/lib/api-guards.js";

// POST: รายงานผู้ใช้
export async function POST(req, { params }) {
  const auth = await requireSessionOrThrow();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "user-report",
    userKey: session.user.email || "anon",
    limit: 5,
    windowMs: 10 * 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const { id } = await params;

  const body = await parseJson(req, {});

  const reason = sanitizeText(body?.reason, { maxLen: 700, allowNewlines: true });
  const evidenceText = sanitizeText(body?.evidenceText, { maxLen: 4000, allowNewlines: true });
  const evidenceImageUrl = sanitizeUrl(body?.evidenceImageUrl, { maxLen: 1000 });

  if (!reason) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  try {
    const connection = await db.getConnection();

    // ป้องกันรายงานตัวเอง
    const [targetRows] = await connection.execute(
      "SELECT id, email FROM users WHERE id = ? LIMIT 1",
      [id]
    );

    if (targetRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetRows[0].email === session.user.email) {
      await connection.release();
      return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
    }

    // ป้องกันรายงานซ้ำภายใน 24 ชั่วโมง
    const [recent] = await connection.execute(
      `SELECT id FROM user_reports
       WHERE reporter_email = ? AND reported_user_id = ?
         AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
       LIMIT 1`,
      [session.user.email, id]
    );

    if (recent.length > 0) {
      await connection.release();
      return NextResponse.json({ error: "Already reported this user recently" }, { status: 429 });
    }

    await connection.execute(
      `INSERT INTO user_reports
        (reporter_email, reported_user_id, reason, evidence_text, evidence_image_url, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      [
        session.user.email,
        id,
        reason,
        evidenceText || null,
        evidenceImageUrl || null,
      ]
    );

    await connection.release();
    return NextResponse.json({ message: "reported" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
