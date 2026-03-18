import { NextResponse } from "next/server";
import { getAppSession, requireAdmin } from "../../../../lib/auth.js";
import { db } from "../../../../lib/db.js";

export async function GET() {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const connection = await db.getConnection();
    const [rows] = await connection.execute(
      `SELECT i.*,
              (SELECT COUNT(*) FROM item_complaints c WHERE c.item_id = i.id) AS complaint_count
       FROM items i
       ORDER BY FIELD(i.approval_status, 'pending','approved','rejected','removed'),
                i.created_at DESC`
    );
    await connection.release();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

