import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

export async function GET(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const ownerEmail = session.user.email;

  try {
    const connection = await db.getConnection();

    // อนุญาตเฉพาะเจ้าของโพสต์ดูรายชื่อผู้ขอแลกของโพสต์ตัวเอง
    const [itemRows] = await connection.execute(
      `SELECT id, owner_email
       FROM items
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (itemRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (itemRows[0].owner_email !== ownerEmail) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [rows] = await connection.execute(
      `SELECT DISTINCT r.requester_email,
              u.id AS requester_id,
              u.name AS requester_name,
              MAX(r.created_at) AS last_requested_at,
              MAX(CASE WHEN r.status = 'completed' THEN 1 ELSE 0 END) AS has_completed
       FROM exchange_requests r
       LEFT JOIN users u ON u.email = r.requester_email
       WHERE r.item_id = ?
         AND r.owner_email = ?
         AND r.status IN ('accepted', 'completed', 'pending')
       GROUP BY r.requester_email, u.id, u.name
       ORDER BY has_completed DESC, last_requested_at DESC`,
      [id, ownerEmail]
    );

    await connection.release();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
