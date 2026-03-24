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
    let columns = [];
    try {
      const [cols] = await connection.query("SHOW COLUMNS FROM admin_audit_logs");
      columns = Array.isArray(cols) ? cols.map((c) => c.Field) : [];
    } catch (e) {
      const msg = String(e?.message || "");
      await connection.release();
      if (msg.includes("doesn't exist")) return NextResponse.json([]);
      return NextResponse.json({ error: msg }, { status: 500 });
    }

    const has = (c) => columns.includes(c);
    const actionExpr = has("action_type")
      ? "l.action_type"
      : has("action")
      ? "l.action"
      : "NULL";
    const adminUserIdExpr = has("admin_user_id") ? "l.admin_user_id" : "NULL";
    const targetTypeExpr = has("target_type") ? "l.target_type" : "NULL";
    const targetIdExpr = has("target_id") ? "l.target_id" : "NULL";
    const detailExpr = has("detail") ? "l.detail" : "NULL";
    const createdAtExpr = has("created_at") ? "l.created_at" : "NULL";
    const idExpr = has("id") ? "l.id" : "0";

    const joinUsers = has("admin_user_id");
    const adminNameExpr = joinUsers ? "a.name" : "NULL";
    const adminEmailExpr = joinUsers
      ? "a.email"
      : has("admin_email")
      ? "l.admin_email"
      : "NULL";

    const sql = `SELECT ${idExpr} AS id,
                        ${adminUserIdExpr} AS admin_user_id,
                        ${actionExpr} AS action_type,
                        ${targetTypeExpr} AS target_type,
                        ${targetIdExpr} AS target_id,
                        ${detailExpr} AS detail,
                        ${createdAtExpr} AS created_at,
                        ${adminNameExpr} AS admin_name,
                        ${adminEmailExpr} AS admin_email
                 FROM admin_audit_logs l
                 ${joinUsers ? "LEFT JOIN users a ON a.id = l.admin_user_id" : ""}
                 ORDER BY ${has("created_at") ? "l.created_at DESC," : ""} ${has("id") ? "l.id DESC" : "1"}
                 LIMIT ?`;

    const [rows] = await connection.execute(sql, [limit]);
    await connection.release();
    return NextResponse.json(Array.isArray(rows) ? rows : []);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
