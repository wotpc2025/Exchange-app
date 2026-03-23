import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

// POST: รายงานผู้ใช้
export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { reason, evidenceText, evidenceImageUrl } = body || {};

  if (!reason || String(reason).trim() === "") {
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
        reason.trim(),
        evidenceText ? String(evidenceText).trim() : null,
        evidenceImageUrl ? String(evidenceImageUrl).trim() : null,
      ]
    );

    await connection.release();
    return NextResponse.json({ message: "reported" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
