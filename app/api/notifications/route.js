import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

async function resolveUserId(connection, session) {
  if (session?.user?.id) return session.user.id;
  const [rows] = await connection.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [session?.user?.email || ""]
  );
  return rows[0]?.id || null;
}

export async function GET() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await db.getConnection();
    const userId = await resolveUserId(connection, session);
    if (!userId) {
      await connection.release();
      return NextResponse.json({ rows: [], unreadCount: 0 });
    }

    const [rows] = await connection.execute(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY is_read ASC, created_at DESC, id DESC
       LIMIT 20`,
      [userId]
    );

    const [unreadRows] = await connection.execute(
      "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    await connection.release();
    return NextResponse.json({
      rows: Array.isArray(rows) ? rows : [],
      unreadCount: unreadRows[0]?.cnt || 0,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
