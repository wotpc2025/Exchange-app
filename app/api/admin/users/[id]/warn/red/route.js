import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { logAdminAction } from "@/lib/admin-audit.js";
import { createNotificationsForUserIds } from "@/lib/notifications.js";
import { enforceRateLimit, parseJson, requireSessionOrThrow } from "@/lib/api-guards.js";

export async function POST(req, { params }) {
  const auth = await requireSessionOrThrow({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "admin-warn-red",
    userKey: session.user.email || "admin",
    limit: 80,
    windowMs: 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const { id } = await params;
  const { reason, reportId } = await parseJson(req, {});

  try {
    const connection = await db.getConnection();
    await connection.execute(
      "INSERT INTO user_warnings (user_id, type, reason, issued_by_admin_id) VALUES (?, 'red', ?, ?)",
      [id, reason || null, session.user.id || null]
    );

    await createNotificationsForUserIds({
      userIds: [Number(id)],
      type: "warning",
      title: "คุณได้รับใบแดง",
      body: reason ? `เหตุผล: ${String(reason).slice(0, 200)}` : "กรุณาติดต่อแอดมินหากต้องการข้อมูลเพิ่มเติม",
      link: "/profile",
      connection,
    });

    await logAdminAction({
      adminUserId: session.user.id || null,
      actionType: reportId ? "report_warn_red" : "user_warn_red",
      targetType: reportId ? "user_report" : "user",
      targetId: reportId ? Number(reportId) : Number(id),
      detail: `user=${id}${reason ? `,reason=${String(reason).slice(0, 250)}` : ""}`,
      connection,
    });

    await connection.release();
    return NextResponse.json({ message: "red_given" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

