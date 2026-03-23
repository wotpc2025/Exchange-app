import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

// GET: ดึงรีวิวที่ตัวเองได้รับ (ใช้ใน /profile)
export async function GET() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const connection = await db.getConnection();

    const [userRows] = await connection.execute(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [session.user.email]
    );

    if (userRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userId = userRows[0].id;

    const [reviews] = await connection.execute(
      `SELECT
         er.id,
         er.punctuality,
         er.accuracy,
         er.politeness,
         er.comment,
         er.created_at,
         reviewer.name AS reviewer_name,
         reviewer.image AS reviewer_image,
         ROUND((er.punctuality + er.accuracy + er.politeness) / 3, 1) AS avg_score
       FROM exchange_reviews er
       JOIN users reviewer ON reviewer.id = er.reviewer_user_id
       WHERE er.reviewed_user_id = ?
       ORDER BY er.created_at DESC`,
      [userId]
    );

    await connection.release();
    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
