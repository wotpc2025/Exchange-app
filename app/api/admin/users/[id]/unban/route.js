import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { logAdminAction } from "@/lib/admin-audit.js";
import { createNotificationsForUserIds } from "@/lib/notifications.js";
import { enforceRateLimit, requireSessionOrThrow } from "@/lib/api-guards.js";

export async function POST(req, { params }) {
  const auth = await requireSessionOrThrow({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "admin-unban",
    userKey: session.user.email || "admin",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limitResponse) return limitResponse;

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

