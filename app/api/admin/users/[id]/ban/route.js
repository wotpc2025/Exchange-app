import { NextResponse } from "next/server";
import { db } from "../../../../../../lib/db.js";
import { getAppSession, requireAdmin } from "../../../../../../lib/auth.js";

function computeEndAt(amount, unit) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return null;
  const now = new Date();
  if (unit === "day") now.setDate(now.getDate() + n);
  else if (unit === "month") now.setMonth(now.getMonth() + n);
  else if (unit === "year") now.setFullYear(now.getFullYear() + n);
  else return null;
  // MySQL DATETIME/TIMESTAMP string
  const pad = (x) => String(x).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(
    now.getHours()
  )}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const banType = body.ban_type; // temporary|permanent
  const reason = body.reason || null;

  if (banType !== "temporary" && banType !== "permanent") {
    return NextResponse.json({ error: "ban_type invalid" }, { status: 400 });
  }

  let endAt = null;
  if (banType === "temporary") {
    endAt = computeEndAt(body.amount, body.unit);
    if (!endAt) {
      return NextResponse.json({ error: "amount/unit invalid" }, { status: 400 });
    }
  }

  try {
    const connection = await db.getConnection();

    // ต้องมีใบแดงก่อนถึงจะแบนได้
    const [reds] = await connection.execute(
      "SELECT COUNT(*) AS red_count FROM user_warnings WHERE user_id = ? AND type = 'red'",
      [id]
    );
    const redCount = reds[0]?.red_count || 0;
    if (redCount < 1) {
      await connection.release();
      return NextResponse.json(
        { error: "ต้องมีใบแดงก่อนถึงจะแบนได้" },
        { status: 400 }
      );
    }

    // ปิดแบนเก่าที่ active
    await connection.execute(
      "UPDATE user_bans SET active = 0 WHERE user_id = ? AND active = 1",
      [id]
    );

    await connection.execute(
      "INSERT INTO user_bans (user_id, ban_type, end_at, reason, issued_by_admin_id, active) VALUES (?, ?, ?, ?, ?, 1)",
      [id, banType, endAt, reason, session.user.id || null]
    );

    await connection.release();
    return NextResponse.json({ message: "banned" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

