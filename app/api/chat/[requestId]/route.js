import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { requireAdmin } from "@/lib/auth.js";
import { sanitizeText } from "@/lib/security.js";
import { enforceRateLimit, parseJson, requireSessionOrThrow } from "@/lib/api-guards.js";

// 🟢 GET: ดึงประวัติแชทและข้อมูลคำขอ
export async function GET(req, { params }) {
  const auth = await requireSessionOrThrow();
  if (!auth.ok) {
    return auth.response;
  }
  const { session } = auth;

  const { requestId } = await params;
  try {
    const connection = await db.getConnection();

    // ดึงข้อมูลคำขอพร้อมรายละเอียดสินค้า
    const [requestData] = await connection.execute(
      `SELECT r.*,
              i.title as item_title,
              i.image_url as item_image,
              i.status as item_status,
              i.approval_status as item_approval_status,
              i.exchanged_like_given as exchanged_like_given,
              owner.id AS owner_id,
              owner.name AS owner_name,
              requester.id AS requester_id,
              requester.name AS requester_name
       FROM exchange_requests r
       JOIN items i ON r.item_id = i.id
       JOIN users owner ON owner.email = r.owner_email
       JOIN users requester ON requester.email = r.requester_email
       WHERE r.id = ?`,
      [requestId]
    );

    if (!requestData[0]) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = requestData[0];
    const isAdmin = requireAdmin(session);
    const canRead =
      isAdmin ||
      r.owner_email === session.user.email ||
      r.requester_email === session.user.email;

    if (!canRead) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ดึงข้อความแชท
    const [messages] = await connection.execute(
      "SELECT * FROM messages WHERE request_id = ? ORDER BY created_at ASC",
      [requestId]
    );

    await connection.release();
    return NextResponse.json({ request: r, messages });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 🔵 POST: ส่งข้อความใหม่
export async function POST(req, { params }) {
  const auth = await requireSessionOrThrow();
  if (!auth.ok) {
    return auth.response;
  }
  const { session } = auth;

  const { requestId } = await params;
  try {
    const limitResponse = enforceRateLimit(req, {
      scope: "chat-post",
      userKey: session.user.email || "anon",
      limit: 12,
      windowMs: 30 * 1000,
    });
    if (limitResponse) {
      return limitResponse;
    }

    const body = await parseJson(req, {});
    const messageText = sanitizeText(body?.message_text, { maxLen: 1200, allowNewlines: true });
    if (!messageText) {
      return NextResponse.json({ error: "message_text required" }, { status: 400 });
    }

    const connection = await db.getConnection();

    const [requestRows] = await connection.execute(
      "SELECT owner_email, requester_email FROM exchange_requests WHERE id = ? LIMIT 1",
      [requestId]
    );

    if (!requestRows[0]) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = requestRows[0];
    const isAdmin = requireAdmin(session);
    const canSend =
      isAdmin ||
      r.owner_email === session.user.email ||
      r.requester_email === session.user.email;
    if (!canSend) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await connection.execute(
      "INSERT INTO messages (request_id, sender_email, message_text) VALUES (?, ?, ?)",
      [requestId, session.user.email, messageText]
    );

    await connection.release();
    return NextResponse.json({ message: "ส่งข้อความแล้ว" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}