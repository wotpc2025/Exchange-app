import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession, requireAdmin } from "@/lib/auth.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({}));

  try {
    const connection = await db.getConnection();
    await connection.execute(
      "INSERT INTO user_warnings (user_id, type, reason, issued_by_admin_id) VALUES (?, 'red', ?, ?)",
      [id, reason || null, session.user.id || null]
    );
    await connection.release();
    return NextResponse.json({ message: "red_given" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

