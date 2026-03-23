import { db } from "@/lib/db.js";

export async function logAdminAction({
  adminUserId = null,
  actionType,
  targetType = null,
  targetId = null,
  detail = null,
  connection = null,
}) {
  if (!actionType) return;

  const useOwnConnection = !connection;
  const conn = connection || (await db.getConnection());

  try {
    await conn.execute(
      `INSERT INTO admin_audit_logs
         (admin_user_id, action_type, target_type, target_id, detail)
       VALUES (?, ?, ?, ?, ?)`,
      [adminUserId || null, actionType, targetType || null, targetId || null, detail || null]
    );
  } catch {
    // Best-effort logging. Do not block main action if audit table is not ready.
  } finally {
    if (useOwnConnection) {
      await conn.release();
    }
  }
}
