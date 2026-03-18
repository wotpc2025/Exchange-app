import { NextResponse } from "next/server";
import { getAppSession, requireAdmin } from "../../../../lib/auth.js";
import { db } from "../../../../lib/db.js";

export async function GET() {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.execute(
      `SELECT u.id, u.email, u.name, u.image, u.role, u.created_at,
              (SELECT COUNT(*) FROM user_warnings w WHERE w.user_id = u.id AND w.type = 'yellow') AS yellow_count,
              (SELECT COUNT(*) FROM user_warnings w WHERE w.user_id = u.id AND w.type = 'red') AS red_count,
              (SELECT ban_type FROM user_bans b WHERE b.user_id = u.id AND b.active = 1 ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS active_ban_type,
              (SELECT end_at FROM user_bans b WHERE b.user_id = u.id AND b.active = 1 ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS active_ban_end_at,
              (SELECT reason FROM user_bans b WHERE b.user_id = u.id AND b.active = 1 ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS active_ban_reason
       FROM users u
       WHERE u.role = 'student'
       ORDER BY u.created_at DESC`
    );

    await connection.release();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

