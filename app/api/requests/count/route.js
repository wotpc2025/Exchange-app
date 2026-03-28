import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const item_id = searchParams.get("item_id");
  if (!item_id) return NextResponse.json({ count: 0 });

  try {
    const [rows] = await db.execute(
      "SELECT COUNT(*) as count FROM exchange_requests WHERE item_id = ?",
      [item_id]
    );
    return NextResponse.json({ count: rows[0]?.count || 0 });
  } catch (error) {
    return NextResponse.json({ count: 0, error: error.message }, { status: 500 });
  }
}
