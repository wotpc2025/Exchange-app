import { NextResponse } from "next/server";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

export async function GET(req) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const limitRaw = Number(url.searchParams.get("limit") || 100);
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 300) : 100;

  try {
    const connection = await db.getConnection();
    const [rows] = await connection.execute(
      `SELECT l.id,
              l.admin_user_id,
              l.action_type,
              l.target_type,
              l.target_id,
              l.detail,
              l.created_at,
              a.name AS admin_name,
              a.email AS admin_email
       FROM admin_audit_logs l
       LEFT JOIN users a ON a.id = l.admin_user_id
       ORDER BY l.created_at DESC, l.id DESC
       LIMIT ?`,
      [limit]
    );

    await connection.release();
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
