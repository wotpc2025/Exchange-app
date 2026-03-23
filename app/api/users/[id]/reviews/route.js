import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

// GET: ดึงรีวิวที่ user นี้ได้รับ
export async function GET(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  try {
    const connection = await db.getConnection();

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
      [id]
    );

    await connection.release();
    return NextResponse.json({ reviews });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
