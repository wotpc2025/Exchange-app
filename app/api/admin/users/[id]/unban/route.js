import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { logAdminAction } from "@/lib/admin-audit.js";
import { createNotificationsForUserIds } from "@/lib/notifications.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const connection = await db.getConnection();
    await connection.execute(
      "UPDATE user_bans SET active = 0 WHERE user_id = ? AND active = 1",
      [id]
    );

    await createNotificationsForUserIds({
      userIds: [Number(id)],
      type: "ban",
      title: "บัญชีของคุณถูกปลดแบนแล้ว",
      body: "ตอนนี้คุณสามารถใช้งานระบบได้ตามปกติ",
      link: "/profile",
      connection,
    });

    await logAdminAction({
      adminUserId: session.user.id || null,
      actionType: "user_unbanned",
      targetType: "user",
      targetId: Number(id),
      connection,
    });

    await connection.release();
    return NextResponse.json({ message: "unbanned" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

