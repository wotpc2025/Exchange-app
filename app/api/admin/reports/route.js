import { NextResponse } from "next/server";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

export async function GET() {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.execute(
      `SELECT r.id,
              r.reporter_email,
              r.reported_user_id,
              r.reason,
              r.evidence_text,
              r.evidence_image_url,
              r.status,
              r.created_at,
              reporter.id AS reporter_id,
              reporter.name AS reporter_name,
              reported.email AS reported_email,
              reported.name AS reported_name,
              (SELECT COUNT(*) FROM user_warnings w WHERE w.user_id = r.reported_user_id AND w.type = 'yellow') AS reported_yellow_count,
              (SELECT COUNT(*) FROM user_warnings w WHERE w.user_id = r.reported_user_id AND w.type = 'red') AS reported_red_count,
              (SELECT ban_type FROM user_bans b WHERE b.user_id = r.reported_user_id AND b.active = 1 ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS reported_active_ban_type,
              (SELECT end_at FROM user_bans b WHERE b.user_id = r.reported_user_id AND b.active = 1 ORDER BY b.created_at DESC, b.id DESC LIMIT 1) AS reported_active_ban_end_at
       FROM user_reports r
       LEFT JOIN users reporter ON reporter.email = r.reporter_email
       LEFT JOIN users reported ON reported.id = r.reported_user_id
       ORDER BY FIELD(r.status, 'open', 'reviewed', 'closed'), r.created_at DESC, r.id DESC`
    );

    await connection.release();
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
