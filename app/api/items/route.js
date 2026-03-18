import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession } from "../../../lib/auth.js";

// 🏠 คอนฟิกฐานข้อมูล (แยกไว้จะได้ไม่พิมพ์ซ้ำ)
const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

// 🟢 1. GET: สำหรับดึงรายการสิ่งของไปโชว์หน้าแรก (โค้ดเดิมของคุณ)
export async function GET() {
  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      "SELECT * FROM items WHERE approval_status = 'approved' AND approval_status <> 'removed' ORDER BY created_at DESC"
    );
    await connection.end();
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
    const connection = await mysql.createConnection(dbConfig);

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

    await connection.end();

    return NextResponse.json({ message: "บันทึกสำเร็จ", id: result.insertId }, { status: 201 });

  } catch (error) {
    console.error("POST API Error:", error);
    return NextResponse.json(
      { error: "บันทึกข้อมูลไม่สำเร็จ: " + error.message }, 
      { status: 500 }
    );
  }
}