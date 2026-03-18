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

    // เพิ่มใบเหลือง
    await connection.execute(
      "INSERT INTO user_warnings (user_id, type, reason, issued_by_admin_id) VALUES (?, 'yellow', ?, ?)",
      [id, reason || null, session.user.id || null]
    );

    // ถ้าครบ 2 ใบเหลือง -> เพิ่มใบแดงอัตโนมัติ (ครั้งเดียวต่อ threshold)
    const [counts] = await connection.execute(
      "SELECT COUNT(*) AS yellow_count FROM user_warnings WHERE user_id = ? AND type = 'yellow'",
      [id]
    );
    const yellowCount = counts[0]?.yellow_count || 0;

    if (yellowCount >= 2) {
      const [reds] = await connection.execute(
        "SELECT COUNT(*) AS red_count FROM user_warnings WHERE user_id = ? AND type = 'red'",
        [id]
      );
      const redCount = reds[0]?.red_count || 0;

      if (redCount === 0) {
        await connection.execute(
          "INSERT INTO user_warnings (user_id, type, reason, issued_by_admin_id) VALUES (?, 'red', ?, ?)",
          [id, "Auto: ได้ใบเหลืองครบ 2 ใบ", session.user.id || null]
        );
      }
    }

    await connection.release();
    return NextResponse.json({ message: "yellow_given" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

