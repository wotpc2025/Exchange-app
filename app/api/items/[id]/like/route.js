import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const likerEmail = session.user.email;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    const [itemRows] = await connection.execute(
      `SELECT id, owner_email, status, exchanged_with_email, exchanged_like_given
       FROM items
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [id]
    );

    if (itemRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = itemRows[0];

    if (item.owner_email !== likerEmail) {
      await connection.rollback();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (item.status !== "exchanged") {
      await connection.rollback();
      return NextResponse.json({ error: "Item is not exchanged yet" }, { status: 400 });
    }

    if (!item.exchanged_with_email) {
      await connection.rollback();
      return NextResponse.json(
        { error: "No exchange partner found for this item" },
        { status: 400 }
      );
    }

    if (Number(item.exchanged_like_given) === 1) {
      await connection.rollback();
      return NextResponse.json({ error: "You already liked this user", alreadyLiked: true }, { status: 409 });
    }

    const [likedUserRows] = await connection.execute(
      `SELECT id, email, name
       FROM users
       WHERE email = ?
       LIMIT 1`,
      [item.exchanged_with_email]
    );

    if (likedUserRows.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: "Exchange partner not found" }, { status: 404 });
    }

    await connection.execute(
      `UPDATE users
       SET admin_likes_received = COALESCE(admin_likes_received, 0) + 1
       WHERE email = ?`,
      [item.exchanged_with_email]
    );

    await connection.execute(
      `UPDATE items
       SET exchanged_like_given = 1,
           exchanged_liked_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [id]
    );

    await connection.commit();

    return NextResponse.json({
      message: "liked",
      likedUser: likedUserRows[0],
    });
  } catch (error) {
    if (connection) {
      try {
        await connection.rollback();
      } catch {
        // ignore rollback error
      }
    }

    const msg = String(error?.message || "");
    if (msg.includes("Unknown column")) {
      return NextResponse.json(
        {
          error:
            "DB ยังไม่อัปเดตคอลัมน์สำหรับระบบไลก์หลังแลกสำเร็จ (Unknown column). กรุณารัน SQL อัปเดต schema ก่อน",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}
