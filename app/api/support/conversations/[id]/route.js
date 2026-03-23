import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession, requireAdmin } from "@/lib/auth.js";
import { sanitizeText } from "@/lib/security.js";
import { enforceRateLimit, parseJson } from "@/lib/api-guards.js";

export async function GET(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isAdmin = requireAdmin(session);
  const email = session.user.email;
  const { id } = await params;

  try {
    const connection = await db.getConnection();

    const [convs] = await connection.execute(
      `SELECT c.*,
              stu.id AS student_id,
              stu.name AS student_name,
              adm.id AS admin_id,
              adm.name AS admin_name,
              (SELECT message_text
                 FROM support_messages m
                WHERE m.conversation_id = c.id
                ORDER BY m.created_at ASC, m.id ASC
                LIMIT 1) AS subject
       FROM support_conversations c
       JOIN users stu ON stu.email = c.student_email
       LEFT JOIN users adm ON adm.email = c.admin_email
       WHERE c.id = ?
       LIMIT 1`,
      [id]
    );
    if (convs.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conv = convs[0];
    if (!isAdmin && conv.student_email !== email) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [messages] = await connection.execute(
      "SELECT * FROM support_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
      [id]
    );

    await connection.release();
    return NextResponse.json({ conversation: conv, messages });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limitResponse = enforceRateLimit(req, {
    scope: "support-message",
    userKey: session.user.email || "anon",
    limit: 15,
    windowMs: 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const isAdmin = requireAdmin(session);
  const email = session.user.email;
  const { id } = await params;

  const body = await parseJson(req, {});
  const text = sanitizeText(body?.message_text, { maxLen: 2000, allowNewlines: true });
  if (!text) return NextResponse.json({ error: "message_text required" }, { status: 400 });

  try {
    const connection = await db.getConnection();

    const [convs] = await connection.execute(
      "SELECT * FROM support_conversations WHERE id = ? LIMIT 1",
      [id]
    );
    if (convs.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const conv = convs[0];

    if (conv.status !== "open") {
      await connection.release();
      return NextResponse.json({ error: "Conversation closed" }, { status: 400 });
    }

    if (!isAdmin && conv.student_email !== email) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const senderRole = isAdmin ? "admin" : "student";

    // admin ที่เข้ามาตอบครั้งแรก -> เซ็ต admin_email
    if (isAdmin && !conv.admin_email) {
      await connection.execute(
        "UPDATE support_conversations SET admin_email = ? WHERE id = ? AND admin_email IS NULL",
        [email, id]
      );
    }

    await connection.execute(
      "INSERT INTO support_messages (conversation_id, sender_email, sender_role, message_text) VALUES (?, ?, ?, ?)",
      [id, email, senderRole, text]
    );

    await connection.release();
    return NextResponse.json({ message: "sent" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

