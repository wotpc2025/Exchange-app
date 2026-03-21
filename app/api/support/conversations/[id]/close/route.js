import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession, requireAdmin } from "@/lib/auth.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // เปลี่ยนเงื่อนไข: นักศึกษาเป็นคนจบเคส (admin ห้ามจบ)
  if (requireAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  let body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const likeAdmin = Boolean(body?.likeAdmin);

  let connection;
  try {
    connection = await db.getConnection();
    const studentEmail = session.user.email;

    const [convs] = await connection.execute(
      "SELECT * FROM support_conversations WHERE id = ? LIMIT 1",
      [id]
    );
    if (convs.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conv = convs[0];
    if (conv.student_email !== studentEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (conv.status !== "open") {
      return NextResponse.json({ error: "Conversation already closed" }, { status: 400 });
    }

    if (!conv.admin_email) {
      return NextResponse.json(
        { error: "ยังไม่มีแอดมินรับเรื่อง จึงยังปิดเคสไม่ได้" },
        { status: 400 }
      );
    }

    try {
      await connection.execute(
        `UPDATE support_conversations
            SET status = 'closed',
                closed_at = CURRENT_TIMESTAMP,
                closed_by_student_email = ?,
                student_liked_admin = ?,
                liked_at = CASE WHEN ? = 1 THEN CURRENT_TIMESTAMP ELSE NULL END
          WHERE id = ?`,
        [studentEmail, likeAdmin ? 1 : 0, likeAdmin ? 1 : 0, id]
      );
    } catch (queryError) {
      const msg = String(queryError?.message || "");
      if (!msg.includes("Unknown column")) throw queryError;

      // fallback สำหรับ DB schema เก่า: ปิดเคสด้วยคอลัมน์พื้นฐานก่อน
      await connection.execute(
        `UPDATE support_conversations
            SET status = 'closed'
          WHERE id = ?`,
        [id]
      );
    }

    // เพิ่มสถิติให้แอดมินที่รับเรื่อง
    try {
      await connection.execute(
        `UPDATE users
            SET admin_success_cases = COALESCE(admin_success_cases, 0) + 1,
                admin_likes_received = COALESCE(admin_likes_received, 0) + ?
          WHERE email = ? AND role = 'admin'`,
        [likeAdmin ? 1 : 0, conv.admin_email]
      );
    } catch (queryError) {
      const msg = String(queryError?.message || "");
      if (!msg.includes("Unknown column")) throw queryError;

      // fallback สำหรับ schema เก่า: พยายามอัปเดตเท่าที่ทำได้ แต่ไม่ทำให้ปิดเคสล้ม
      try {
        await connection.execute(
          `UPDATE users
              SET admin_success_cases = COALESCE(admin_success_cases, 0) + 1
            WHERE email = ? AND role = 'admin'`,
          [conv.admin_email]
        );
      } catch {
        // ignore stats update error to keep close-case successful
      }
    }

    return NextResponse.json({ message: "closed" });
  } catch (error) {
    // ถ้า DB ยังไม่มีคอลัมน์ใหม่ ให้ขึ้น error ที่เข้าใจได้
    const msg = String(error?.message || "");
    if (msg.includes("Unknown column")) {
      return NextResponse.json(
        {
          error:
            "DB ยังไม่อัปเดตคอลัมน์สำหรับระบบปิดเคส/ไลก์แอดมิน (Unknown column). กรุณารันคำสั่ง SQL อัปเดต schema ก่อน",
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

