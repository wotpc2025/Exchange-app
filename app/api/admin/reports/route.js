import { NextResponse } from "next/server";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { db } from "@/lib/db.js";
import { loadActiveBansByUserId, loadWarningCountsByUserId } from "@/lib/admin-reports-enrich.js";

async function fetchReportRows(connection) {
  const orderBy = `ORDER BY FIELD(r.status, 'open', 'reviewed', 'closed'), r.created_at DESC, r.id DESC`;
  const base = `SELECT r.id,
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
              reported.name AS reported_name
       FROM user_reports r
       LEFT JOIN users reporter ON reporter.email = r.reporter_email
       LEFT JOIN users reported ON reported.id = r.reported_user_id
       ${orderBy}`;

  try {
    const [rows] = await connection.execute(base);
    return Array.isArray(rows) ? rows : [];
  } catch (e) {
    const msg = String(e?.message || "");
    if (msg.includes("Illegal mix of collations") || msg.includes("Collation")) {
      const baseBin = base.replace(
        "reporter.email = r.reporter_email",
        "BINARY reporter.email = BINARY r.reporter_email"
      );
      const [rows] = await connection.execute(baseBin);
      return Array.isArray(rows) ? rows : [];
    }
    throw e;
  }
}

export async function GET() {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await ensureUserReportsTable(connection);

    const rows = await fetchReportRows(connection);
    const ids = rows.map((r) => r.reported_user_id);

    const [warnMap, banMap] = await Promise.all([
      loadWarningCountsByUserId(connection, ids),
      loadActiveBansByUserId(connection, ids),
    ]);

    const enriched = rows.map((r) => {
      const uid = Number(r.reported_user_id);
      const w = warnMap.get(uid) || { yellow: 0, red: 0 };
      const b = banMap.get(uid);
      return {
        ...r,
        reported_yellow_count: w.yellow,
        reported_red_count: w.red,
        reported_active_ban_type: b?.ban_type ?? null,
        reported_active_ban_end_at: b?.end_at ?? null,
      };
    });

    return NextResponse.json(enriched);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) connection.release();
  }
}
