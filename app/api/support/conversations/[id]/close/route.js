import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession, requireAdmin } from "../../../../../../lib/auth.js";

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

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

  try {
    const connection = await mysql.createConnection(dbConfig);
    const studentEmail = session.user.email;

    const [convs] = await connection.execute(
      "SELECT * FROM support_conversations WHERE id = ? LIMIT 1",
      [id]
    );
    if (convs.length === 0) {
      await connection.end();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conv = convs[0];
    if (conv.student_email !== studentEmail) {
      await connection.end();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (conv.status !== "open") {
      await connection.end();
      return NextResponse.json({ error: "Conversation already closed" }, { status: 400 });
    }

    if (!conv.admin_email) {
      await connection.end();
      return NextResponse.json(
        { error: "ยังไม่มีแอดมินรับเรื่อง จึงยังปิดเคสไม่ได้" },
        { status: 400 }
      );
    }

    await connection.beginTransaction();

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

    // เพิ่มสถิติให้แอดมินที่รับเรื่อง
    await connection.execute(
      `UPDATE users
          SET admin_success_cases = COALESCE(admin_success_cases, 0) + 1,
              admin_likes_received = COALESCE(admin_likes_received, 0) + ?
        WHERE email = ? AND role = 'admin'`,
      [likeAdmin ? 1 : 0, conv.admin_email]
    );

    await connection.commit();
    await connection.end();
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
  }
}

