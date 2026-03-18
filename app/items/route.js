import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

export async function POST(req) {
  try {
    const data = await req.json();
    const { title, description, category, image_data, owner_email, wishlist } = data;

    // 1. เชื่อมต่อกับ MySQL (XAMPP)
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "", // ปกติ XAMPP ไม่มีรหัสผ่าน
      database: "exchange", // ชื่อ DB ที่คุณสร้างใน phpMyAdmin
    });

    // 2. เขียนคำสั่ง SQL เพื่อ Insert ข้อมูล
    const query = `
      INSERT INTO items (title, description, category, image_url, owner_email, wishlist, status) 
      VALUES (?, ?, ?, ?, ?, ?, 'available')
    `;

    // 3. รันคำสั่ง
    await connection.execute(query, [
      title, 
      description, 
      category, 
      image_data, // ข้อมูลรูปภาพแบบ Base64
      owner_email, 
      wishlist
    ]);

    await connection.end();
    return NextResponse.json({ message: "บันทึกข้อมูลสำเร็จ" }, { status: 200 });

  } catch (error) {
    console.error("Database Error:", error);
    return NextResponse.json({ message: "เกิดข้อผิดพลาด", error: error.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const connection = await mysql.createConnection({
      host: "localhost",
      user: "root",
      password: "",
      database: "exchange",
    });

    // ดึงข้อมูลมาทั้งหมด และเรียงจากใหม่ไปเก่า (DESC)
    const [rows] = await connection.execute("SELECT * FROM items ORDER BY created_at DESC");
    await connection.end();

    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ message: "Error", error: error.message }, { status: 500 });
  }
}