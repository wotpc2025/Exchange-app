import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const itemId = searchParams.get("item_id");
  if (!itemId) {
    return NextResponse.json({ error: "item_id required" }, { status: 400 });
  }
  try {
    const connection = await db.getConnection();
    const [rows] = await connection.execute(
      "SELECT COUNT(*) as count FROM exchange_requests WHERE item_id = ?",
      [itemId]
    );
    await connection.release();
    return NextResponse.json({ count: rows[0].count });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
