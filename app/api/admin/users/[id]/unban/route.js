import { NextResponse } from "next/server";
import { db } from "../../../../../../lib/db.js";
import { getAppSession, requireAdmin } from "../../../../../../lib/auth.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const connection = await db.getConnection();
    await connection.execute(
      "UPDATE user_bans SET active = 0 WHERE user_id = ? AND active = 1",
      [id]
    );
    await connection.release();
    return NextResponse.json({ message: "unbanned" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

