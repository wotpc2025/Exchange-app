import { NextResponse } from "next/server";
import { db } from "../../../lib/db.js";

export async function GET(req, { params }) {
  try {
    // ✅ สำคัญมาก: ต้อง await params ก่อนดึงค่า id ออกมา
    const resolvedParams = await params;
    const id = resolvedParams.id;

    const connection = await db.getConnection();

    // ดึงข้อมูลสินค้าชิ้นที่ระบุ พร้อมข้อมูลเจ้าของ
    const [rows] = await connection.execute(
      `SELECT i.*,
              u.id AS owner_id,
              u.name AS owner_name
       FROM items i
       LEFT JOIN users u ON u.email = i.owner_email
       WHERE i.id = ?`,
      [id]
    );
    await connection.release();

    if (rows.length === 0) {
      return NextResponse.json({ message: "ไม่พบข้อมูลสินค้า" }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ message: "Server Error", error: error.message }, { status: 500 });
  }
}

// ตัวอย่างการเพิ่มฟังก์ชัน DELETE ใน app/api/items/[id]/route.js
export async function DELETE(req, { params }) {
  try {
    const { id } = await params;
    const connection = await db.getConnection();

    await connection.execute("DELETE FROM items WHERE id = ?", [id]);
    await connection.release();

    return NextResponse.json({ message: "ลบรายการสำเร็จ" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// เพิ่ม/แก้ไขใน app/api/items/[id]/route.js
export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, category, wishlist, image_url, status } = body;

    const connection = await db.getConnection();

    // ใช้ COALESCE หรือตรวจสอบค่าเพื่อให้รองรับการอัปเดตเฉพาะบางฟิลด์ (เช่น status อย่างเดียว)
    const [result] = await connection.execute(
      `UPDATE items SET 
        title = COALESCE(?, title), 
        description = COALESCE(?, description), 
        category = COALESCE(?, category), 
        wishlist = COALESCE(?, wishlist), 
        image_url = COALESCE(?, image_url),
        status = COALESCE(?, status)
      WHERE id = ?`,
      [title || null, description || null, category || null, wishlist || null, image_url || null, status || null, id]
    );

    await connection.release();
    return NextResponse.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}