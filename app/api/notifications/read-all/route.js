import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

async function resolveUserId(connection, session) {
  if (session?.user?.id) return session.user.id;
  const [rows] = await connection.execute(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [session?.user?.email || ""]
  );
  return rows[0]?.id || null;
}

export async function POST() {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await db.getConnection();
    const userId = await resolveUserId(connection, session);
    if (!userId) {
      await connection.release();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await connection.execute(
      "UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0",
      [userId]
    );

    await connection.release();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
