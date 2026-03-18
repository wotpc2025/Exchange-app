import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";

// 🔵 POST: สร้างคำขอใหม่ (เรียกใช้ตอนกดปุ่ม "ทักแชท")
export async function POST(req) {
  try {
    const { item_id, requester_email, owner_email, offered_item } = await req.json();
    const connection = await db.getConnection();

    // 1. ตรวจสอบก่อนว่าเคยมี Request ระหว่างคู่นี้ในสินค้าชิ้นนี้หรือยัง (Optional)
    const [existing] = await connection.execute(
      "SELECT id FROM exchange_requests WHERE item_id = ? AND requester_email = ?",
      [item_id, requester_email]
    );

    if (existing.length > 0) {
      await connection.release();
      return NextResponse.json({ id: existing[0].id }); // ถ้ามีแล้วให้ส่ง ID เดิมกลับไปเลย
    }

    // 2. ถ้ายังไม่มี ให้สร้างใหม่
    const [result] = await connection.execute(
      "INSERT INTO exchange_requests (item_id, requester_email, owner_email, offered_item) VALUES (?, ?, ?, ?)",
      [item_id, requester_email, owner_email, offered_item]
    );

    await connection.release();

    // ✅ ส่ง JSON กลับไป (ป้องกัน Error SyntaxError)
    return NextResponse.json({ id: result.insertId }, { status: 201 });
  } catch (error) {
    console.error("Request API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 🟢 GET: ดึงรายการคำขอทั้งหมดของผู้ใช้ (สำหรับหน้า List)
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const userEmail = searchParams.get("user");

  try {
    const connection = await db.getConnection();
    const [rows] = await connection.execute(
      `SELECT r.*,
              i.title AS item_title,
              i.image_url AS item_image,
              owner.id AS owner_id,
              owner.name AS owner_name,
              requester.id AS requester_id,
              requester.name AS requester_name
       FROM exchange_requests r
       JOIN items i ON r.item_id = i.id
       JOIN users owner ON owner.email = r.owner_email
       JOIN users requester ON requester.email = r.requester_email
       WHERE r.owner_email = ? OR r.requester_email = ?
       ORDER BY r.created_at DESC`,
      [userEmail, userEmail]
    );
    await connection.release();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}