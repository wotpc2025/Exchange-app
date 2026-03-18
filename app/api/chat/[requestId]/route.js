import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";

// 🟢 GET: ดึงประวัติแชทและข้อมูลคำขอ
export async function GET(req, { params }) {
  const { requestId } = await params;
  try {
    const connection = await db.getConnection();

    // ดึงข้อมูลคำขอพร้อมรายละเอียดสินค้า
    const [requestData] = await connection.execute(
      `SELECT r.*,
              i.title as item_title,
              i.image_url as item_image,
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

    // ดึงข้อความแชท
    const [messages] = await connection.execute(
      "SELECT * FROM messages WHERE request_id = ? ORDER BY created_at ASC",
      [requestId]
    );

    await connection.release();
    return NextResponse.json({ request: requestData[0], messages });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 🔵 POST: ส่งข้อความใหม่
export async function POST(req, { params }) {
  const { requestId } = await params;
  try {
    const { sender_email, message_text } = await req.json();
    const connection = await db.getConnection();

    await connection.execute(
      "INSERT INTO messages (request_id, sender_email, message_text) VALUES (?, ?, ?)",
      [requestId, sender_email, message_text]
    );

    await connection.release();
    return NextResponse.json({ message: "ส่งข้อความแล้ว" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}