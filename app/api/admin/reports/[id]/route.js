import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { logAdminAction } from "@/lib/admin-audit.js";
import { createNotificationsForEmails, createNotificationsForUserIds } from "@/lib/notifications.js";
import { enforceRateLimit, parseJson, requireSessionOrThrow } from "@/lib/api-guards.js";

export async function PATCH(req, { params }) {
  const auth = await requireSessionOrThrow({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "admin-report-status",
    userKey: session.user.email || "admin",
    limit: 60,
    windowMs: 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const { id } = await params;

  const body = await parseJson(req, {});
  const nextStatus = String(body?.status || "").toLowerCase();

  if (!["open", "reviewed", "closed"].includes(nextStatus)) {
    return NextResponse.json({ error: "status invalid" }, { status: 400 });
  }

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.execute(
      "SELECT id, reporter_email, reported_user_id FROM user_reports WHERE id = ? LIMIT 1",
      [id]
    );

    if (!rows.length) {
      await connection.release();
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    await connection.execute(
      "UPDATE user_reports SET status = ? WHERE id = ?",
      [nextStatus, id]
    );

    const report = rows[0];
    const statusLabel =
      nextStatus === "closed" ? "ปิดเคสแล้ว" : nextStatus === "reviewed" ? "กำลังตรวจสอบ" : "เปิดเคส";

    await createNotificationsForEmails({
      emails: [report.reporter_email],
      type: "report_status",
      title: "สถานะรายงานของคุณถูกอัปเดต",
      body: `เคสรายงาน #${id} ถูกเปลี่ยนสถานะเป็น ${statusLabel}`,
      link: "/profile",
      connection,
    });

    await createNotificationsForUserIds({
      userIds: [report.reported_user_id],
      type: "report_status",
      title: "มีการอัปเดตเคสรายงานที่เกี่ยวข้องกับคุณ",
      body: `เคสรายงาน #${id} ถูกเปลี่ยนสถานะเป็น ${statusLabel}`,
      link: `/users/${report.reported_user_id}`,
      connection,
    });

    await logAdminAction({
      adminUserId: session.user.id || null,
      actionType: "report_status_updated",
      targetType: "user_report",
      targetId: Number(id),
      detail: `status=${nextStatus}`,
      connection,
    });

    await connection.release();
    return NextResponse.json({ ok: true, status: nextStatus });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
