import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

// 🟢 1. GET: สำหรับดึงรายการสิ่งของไปโชว์หน้าแรก (โค้ดเดิมของคุณ)
export async function GET() {
  try {
    const connection = await db.getConnection();
    // ดึง id, title, ... ทุก field ที่จำเป็น (ไม่ filter เฉพาะ approved)
    const [rows] = await connection.execute(
      `SELECT id, title, description, category, wishlist, image_url, owner_email, approval_status, created_at,
        status
      FROM items ORDER BY created_at DESC`
    );
    await connection.release();
    return NextResponse.json(rows);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// 🔵 2. POST: เพิ่มส่วนนี้เข้าไปเพื่อรองรับการ "ลงประกาศ" (ปุ่ม Submit ใน Add Item)
export async function POST(req) {
  try {
    const session = await getAppSession();
    if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (session.user?.role === 'admin') return NextResponse.json({ error: "Admins cannot create items" }, { status: 403 });

    const data = await req.json(); // รับข้อมูลจากหน้าบ้าน
    const connection = await db.getConnection();

    // บันทึกโดยใช้ owner จาก session (ไม่เชื่อถือค่า owner_email จาก client)
    const ownerEmail = session.user.email;

    const [result] = await connection.execute(
      "INSERT INTO items (title, description, category, wishlist, image_url, owner_email, approval_status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
      [
        data.title,
        data.description,
        data.category,
        data.wishlist,
        data.image_data,
        ownerEmail,
      ]
    );

    await connection.release();

    return NextResponse.json({ message: "บันทึกสำเร็จ", id: result.insertId }, { status: 201 });

  } catch (error) {
    console.error("POST API Error:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ: " + error.message }, 
      { status: 500 }
    );
  }
}