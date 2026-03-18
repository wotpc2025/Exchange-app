import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession, requireAdmin } from "@/lib/auth.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body = {};
  try {
    body = await req.json();
  } catch {}

  const adminNote = typeof body.adminNote === "string" ? body.adminNote.trim() : "";

  try {
    const connection = await db.getConnection();
    await connection.execute(
      `UPDATE item_complaints
       SET status = 'closed',
           admin_note = ?,
           closed_by_admin_id = ?,
           closed_at = NOW()
       WHERE id = ?`,
      [adminNote || null, session.user.id || null, id]
    );
    await connection.release();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

