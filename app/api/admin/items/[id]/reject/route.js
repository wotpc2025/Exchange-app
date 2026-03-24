import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { logAdminAction } from "@/lib/admin-audit.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const connection = await db.getConnection();
    await connection.execute(
      "UPDATE items SET approval_status = 'rejected' WHERE id = ?",
      [id]
    );
    await logAdminAction({
      adminUserId: session.user.id || null,
      actionType: "item_rejected",
      targetType: "item",
      targetId: Number(id),
      detail: "approval_status=rejected",
      connection,
    });
    await connection.release();
    return NextResponse.json({ message: "rejected" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

