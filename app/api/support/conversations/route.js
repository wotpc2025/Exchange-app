import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession, requireAdmin } from "../../../../lib/auth.js";

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

// GET: student -> ดูของตัวเอง | admin -> ดูทั้งหมด
export async function GET() {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = requireAdmin(session);
  const email = session.user.email;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [rows] = isAdmin
      ? await connection.execute(
          `SELECT c.*,
                  stu.id AS student_id,
                  stu.name AS student_name,
                  adm.id AS admin_id,
                  adm.name AS admin_name,
                  (SELECT message_text
                     FROM support_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at ASC, m.id ASC
                    LIMIT 1) AS subject,
                  (SELECT message_text
                     FROM support_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1) AS last_message,
                  (SELECT created_at
                     FROM support_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1) AS last_message_at
           FROM support_conversations c
           JOIN users stu ON stu.email = c.student_email
           LEFT JOIN users adm ON adm.email = c.admin_email
           ORDER BY COALESCE(last_message_at, c.created_at) DESC`
        )
      : await connection.execute(
          `SELECT c.*,
                  stu.id AS student_id,
                  stu.name AS student_name,
                  adm.id AS admin_id,
                  adm.name AS admin_name,
                  (SELECT message_text
                     FROM support_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at ASC, m.id ASC
                    LIMIT 1) AS subject,
                  (SELECT message_text
                     FROM support_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1) AS last_message,
                  (SELECT created_at
                     FROM support_messages m
                    WHERE m.conversation_id = c.id
                    ORDER BY m.created_at DESC, m.id DESC
                    LIMIT 1) AS last_message_at
           FROM support_conversations c
           JOIN users stu ON stu.email = c.student_email
           LEFT JOIN users adm ON adm.email = c.admin_email
           WHERE c.student_email = ?
           ORDER BY COALESCE(last_message_at, c.created_at) DESC`,
          [email]
        );

    await connection.end();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: student ส่งข้อความและ "สร้างห้องใหม่" ทุกครั้ง
export async function POST(req) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { message_text } = await req.json();
  const text = (message_text || "").trim();
  if (!text) return NextResponse.json({ error: "message_text required" }, { status: 400 });

  const studentEmail = session.user.email;

  try {
    const connection = await mysql.createConnection(dbConfig);

    const [created] = await connection.execute(
      "INSERT INTO support_conversations (student_email, status) VALUES (?, 'open')",
      [studentEmail]
    );
    let conversationId = created?.insertId;

    // Defensive: หาก DB ยังไม่ AUTO_INCREMENT ถูกต้อง (เช่นเคยมี id=0)
    // insertId อาจเป็น 0/undefined ทำให้หน้าเว็บพาไปห้องเดิมซ้ำ
    if (!conversationId || Number(conversationId) <= 0) {
      const [latest] = await connection.execute(
        "SELECT id FROM support_conversations WHERE student_email = ? ORDER BY created_at DESC, id DESC LIMIT 1",
        [studentEmail]
      );
      conversationId = latest?.[0]?.id;
    }

    if (!conversationId || Number(conversationId) <= 0) {
      await connection.end();
      return NextResponse.json(
        { error: "Failed to create conversation (invalid conversation id). Check AUTO_INCREMENT." },
        { status: 500 }
      );
    }

    await connection.execute(
      "INSERT INTO support_messages (conversation_id, sender_email, sender_role, message_text) VALUES (?, ?, 'student', ?)",
      [conversationId, studentEmail, text]
    );

    await connection.end();
    return NextResponse.json({ conversation_id: conversationId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

