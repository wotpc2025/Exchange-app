import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { logAdminAction } from "@/lib/admin-audit.js";
import { enforceRateLimit, parseJson, requireSessionOrThrow } from "@/lib/api-guards.js";

export async function POST(req, { params }) {
  const auth = await requireSessionOrThrow({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "admin-complaint-close",
    userKey: session.user.email || "admin",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const { id } = await params;

  const body = await parseJson(req, {});

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

    await logAdminAction({
      adminUserId: session.user.id || null,
      actionType: "complaint_closed",
      targetType: "item_complaint",
      targetId: Number(id),
      detail: adminNote || null,
      connection,
    });

    await connection.release();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

