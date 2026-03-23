import { db } from "@/lib/db.js";

async function resolveUserIdsFromEmails(emails, connection) {
  const unique = Array.from(new Set((emails || []).filter(Boolean)));
  if (!unique.length) return [];

  const placeholders = unique.map(() => "?").join(",");
  const [rows] = await connection.execute(
    `SELECT id FROM users WHERE email IN (${placeholders})`,
    unique
  );

  return Array.from(new Set(rows.map((r) => r.id).filter(Boolean)));
}

export async function createNotificationsForUserIds({
  userIds,
  type,
  title,
  body,
  link = null,
  connection = null,
}) {
  const ids = Array.from(new Set((userIds || []).filter(Boolean)));
  if (!ids.length || !type || !title) return;

  const useOwnConnection = !connection;
  const conn = connection || (await db.getConnection());

  try {
    const values = ids.map(() => "(?, ?, ?, ?, ?, 0, NOW())").join(",");
    const params = [];
    for (const id of ids) {
      params.push(id, type, title, body || null, link || null);
    }

    await conn.execute(
      `INSERT INTO notifications
         (user_id, type, title, body, link, is_read, created_at)
       VALUES ${values}`,
      params
    );
  } catch {
    // Best-effort notifications.
  } finally {
    if (useOwnConnection) {
      await conn.release();
    }
  }
}

export async function createNotificationsForEmails({
  emails,
  type,
  title,
  body,
  link = null,
  connection = null,
}) {
  const useOwnConnection = !connection;
  const conn = connection || (await db.getConnection());

  try {
    const userIds = await resolveUserIdsFromEmails(emails, conn);
    await createNotificationsForUserIds({
      userIds,
      type,
      title,
      body,
      link,
      connection: conn,
    });
  } finally {
    if (useOwnConnection) {
      await conn.release();
    }
  }
}
