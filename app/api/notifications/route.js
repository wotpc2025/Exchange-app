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

export async function GET(req) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const pageRaw = Number(url.searchParams.get("page") || 1);
  const limitRaw = Number(url.searchParams.get("limit") || 20);
  const onlyUnread = String(url.searchParams.get("onlyUnread") || "false") === "true";
  const type = String(url.searchParams.get("type") || "").trim();

  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(Math.floor(limitRaw), 1), 100) : 20;
  const offset = (page - 1) * limit;

  try {
    const connection = await db.getConnection();
    const userId = await resolveUserId(connection, session);
    if (!userId) {
      await connection.release();
      return NextResponse.json({ rows: [], unreadCount: 0 });
    }

    const whereClauses = ["user_id = ?"];
    const whereParams = [userId];

    if (onlyUnread) {
      whereClauses.push("is_read = 0");
    }

    if (type) {
      whereClauses.push("type = ?");
      whereParams.push(type);
    }

    const whereSql = whereClauses.join(" AND ");

    const [rows] = await connection.execute(
      `SELECT id, type, title, body, link, is_read, created_at
       FROM notifications
       WHERE ${whereSql}
       ORDER BY is_read ASC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    const [totalRows] = await connection.execute(
      `SELECT COUNT(*) AS cnt
       FROM notifications
       WHERE ${whereSql}`,
      whereParams
    );

    const [unreadRows] = await connection.execute(
      "SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    await connection.release();
    return NextResponse.json({
      rows: Array.isArray(rows) ? rows : [],
      unreadCount: unreadRows[0]?.cnt || 0,
      total: totalRows[0]?.cnt || 0,
      page,
      limit,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
