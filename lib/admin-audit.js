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
    let columns = [];
    try {
      const [rows] = await conn.query("SHOW COLUMNS FROM admin_audit_logs");
      columns = Array.isArray(rows) ? rows.map((r) => r.Field) : [];
    } catch (e) {
      const msg = String(e?.message || "");
      if (!msg.includes("doesn't exist")) throw e;

      await conn.execute(
        `CREATE TABLE IF NOT EXISTS admin_audit_logs (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
          admin_user_id BIGINT NULL,
          action_type VARCHAR(120) NOT NULL,
          target_type VARCHAR(120) NULL,
          target_id BIGINT NULL,
          detail TEXT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )`
      );
      const [rows] = await conn.query("SHOW COLUMNS FROM admin_audit_logs");
      columns = Array.isArray(rows) ? rows.map((r) => r.Field) : [];
    }

    const has = (c) => columns.includes(c);
    const insertCols = [];
    const values = [];

    if (has("admin_user_id")) {
      insertCols.push("admin_user_id");
      values.push(adminUserId || null);
    }
    if (has("action_type")) {
      insertCols.push("action_type");
      values.push(actionType);
    } else if (has("action")) {
      insertCols.push("action");
      values.push(actionType);
    }
    if (has("target_type")) {
      insertCols.push("target_type");
      values.push(targetType || null);
    }
    if (has("target_id")) {
      insertCols.push("target_id");
      const parsedTargetId = Number(targetId);
      values.push(Number.isFinite(parsedTargetId) ? parsedTargetId : null);
    }
    if (has("detail")) {
      insertCols.push("detail");
      values.push(detail || null);
    }
    if (has("admin_email")) {
      insertCols.push("admin_email");
      values.push(null);
    }

    if (!insertCols.length) return;

    const placeholders = insertCols.map(() => "?").join(", ");
    const sql = `INSERT INTO admin_audit_logs (${insertCols.join(", ")}) VALUES (${placeholders})`;
    await conn.execute(sql, values);
  } catch {
    // Best-effort logging. Do not block main action if audit table is not ready.
  } finally {
    if (useOwnConnection) {
      await conn.release();
    }
  }
}
