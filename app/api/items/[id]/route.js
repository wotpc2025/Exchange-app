import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";

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
  let connection;
  try {
    const { id } = await params;
    const body = await req.json();
    const { title, description, category, wishlist, image_url, status, exchanged_with_email } = body;

    connection = await db.getConnection();

    try {
      // โหมดใหม่: อัปเดตคอลัมน์ระบบแลกสำเร็จ/ไลก์ได้ครบ
      await connection.execute(
        `UPDATE items SET 
          title = COALESCE(?, title), 
          description = COALESCE(?, description), 
          category = COALESCE(?, category), 
          wishlist = COALESCE(?, wishlist), 
          image_url = COALESCE(?, image_url),
          status = COALESCE(?, status),
          exchanged_with_email = CASE
            WHEN ? = 'exchanged' THEN COALESCE(?, exchanged_with_email)
            WHEN ? IS NOT NULL AND ? <> 'exchanged' THEN NULL
            ELSE exchanged_with_email
          END,
          exchanged_like_given = CASE
            WHEN ? = 'exchanged' THEN 0
            WHEN ? IS NOT NULL AND ? <> 'exchanged' THEN 0
            ELSE exchanged_like_given
          END,
          exchanged_liked_at = CASE
            WHEN ? = 'exchanged' THEN NULL
            WHEN ? IS NOT NULL AND ? <> 'exchanged' THEN NULL
            ELSE exchanged_liked_at
          END
        WHERE id = ?`,
        [
          title || null,
          description || null,
          category || null,
          wishlist || null,
          image_url || null,
          status || null,
          status || null,
          exchanged_with_email || null,
          status || null,
          status || null,
          status || null,
          status || null,
          status || null,
          status || null,
          id,
        ]
      );
    } catch (queryError) {
      const msg = String(queryError?.message || "");
      if (!msg.includes("Unknown column")) throw queryError;

      // โหมดเก่า: fallback เมื่อ DB ยังไม่เพิ่มคอลัมน์ใหม่
      await connection.execute(
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
    }

    return NextResponse.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) await connection.release();
  }
}