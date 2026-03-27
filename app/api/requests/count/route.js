import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";

// GET /api/requests/count?item_id=xxx
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("item_id");
  if (!itemId) {
    return NextResponse.json({ error: "item_id is required" }, { status: 400 });
  }
  try {
    const connection = await db.getConnection();
    const [rows] = await connection.execute(
      "SELECT COUNT(*) AS count FROM exchange_requests WHERE item_id = ? AND status != 'rejected'",
      [itemId]
    );
    await connection.release();
    return NextResponse.json({ count: rows[0]?.count || 0 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
