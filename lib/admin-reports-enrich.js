/**
 * Enrich admin report rows with warning/ban aggregates.
 * Tolerates missing user_warnings / user_bans (returns zeros / nulls).
 */

function isMissingTableOrBadField(e) {
  const code = e?.code;
  const msg = String(e?.message || "");
  return (
    code === "ER_NO_SUCH_TABLE" ||
    code === "ER_BAD_FIELD_ERROR" ||
    msg.includes("doesn't exist") ||
    msg.includes("Unknown table") ||
    msg.includes("Unknown column")
  );
}

function uniqueIds(ids) {
  return [...new Set(ids.filter((id) => id != null && id !== ""))].map((id) => Number(id)).filter((n) => Number.isFinite(n));
}

/**
 * @param {import("mysql2/promise").PoolConnection} connection
 * @param {number[]} reportedUserIds
 * @returns {Promise<Map<number, { yellow: number, red: number }>>}
 */
export async function loadWarningCountsByUserId(connection, reportedUserIds) {
  const ids = uniqueIds(reportedUserIds);
  const empty = () => {
    const m = new Map();
    for (const id of ids) m.set(id, { yellow: 0, red: 0 });
    return m;
  };
  if (!ids.length) return new Map();

  try {
    const ph = ids.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT user_id,
              SUM(CASE WHEN type = 'yellow' THEN 1 ELSE 0 END) AS yellow_count,
              SUM(CASE WHEN type = 'red' THEN 1 ELSE 0 END) AS red_count
       FROM user_warnings
       WHERE user_id IN (${ph})
       GROUP BY user_id`,
      ids
    );
    const map = empty();
    for (const row of rows) {
      const uid = Number(row.user_id);
      map.set(uid, {
        yellow: Number(row.yellow_count) || 0,
        red: Number(row.red_count) || 0,
      });
    }
    return map;
  } catch (e) {
    if (!isMissingTableOrBadField(e)) throw e;
    return empty();
  }
}

/**
 * Latest active ban per user (matches per-row subquery in admin users list).
 * @returns {Promise<Map<number, { ban_type: string, end_at: Date|string|null }>>}
 */
export async function loadActiveBansByUserId(connection, reportedUserIds) {
  const ids = uniqueIds(reportedUserIds);
  if (!ids.length) return new Map();

  try {
    const ph = ids.map(() => "?").join(",");
    const [rows] = await connection.execute(
      `SELECT b.user_id, b.ban_type, b.end_at
       FROM user_bans b
       INNER JOIN (
         SELECT user_id, MAX(id) AS max_id
         FROM user_bans
         WHERE active = 1 AND user_id IN (${ph})
         GROUP BY user_id
       ) t ON t.user_id = b.user_id AND t.max_id = b.id
       WHERE b.active = 1`,
      ids
    );
    const map = new Map();
    for (const row of rows) {
      map.set(Number(row.user_id), {
        ban_type: row.ban_type,
        end_at: row.end_at,
      });
    }
    return map;
  } catch (e) {
    if (!isMissingTableOrBadField(e)) throw e;
    return new Map();
  }
}
