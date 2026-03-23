import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

// 🟢 1. GET: สำหรับดึงรายการสิ่งของไปโชว์หน้าแรก (โค้ดเดิมของคุณ)
export async function GET() {
  let connection;
  try {
    connection = await db.getConnection();
    let rows;

    try {
      // โหมดใหม่: มีคอลัมน์ระบบแลกสำเร็จ + ไลก์
      const [newRows] = await connection.execute(
        `SELECT id, title, description, category, wishlist, image_url, owner_email, approval_status, created_at,
          status, exchanged_with_email, exchanged_like_given
        FROM items ORDER BY created_at DESC`
      );
      rows = newRows;
    } catch (queryError) {
      const msg = String(queryError?.message || "");
      if (!msg.includes("Unknown column")) throw queryError;

      // โหมดเก่า: fallback เมื่อ DB ยังไม่เพิ่มคอลัมน์ใหม่
      const [legacyRows] = await connection.execute(
        `SELECT id, title, description, category, wishlist, image_url, owner_email, approval_status, created_at,
          status
        FROM items ORDER BY created_at DESC`
      );

      rows = legacyRows.map((row) => ({
        ...row,
        exchanged_with_email: null,
        exchanged_like_given: 0,
      }));
    }

    return NextResponse.json(rows);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) await connection.release();
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

    const rawImages = Array.isArray(data.images_data) ? data.images_data : [];
    const normalizedImages = rawImages
      .map((v) => (typeof v === "string" ? v.trim() : ""))
      .filter((v) => v !== "")
      .slice(0, 8);
    const primaryImage = normalizedImages[0] || data.image_data || null;

    if (!primaryImage) {
      await connection.release();
      return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
    }

    const [result] = await connection.execute(
      "INSERT INTO items (title, description, category, wishlist, image_url, owner_email, approval_status) VALUES (?, ?, ?, ?, ?, ?, 'pending')",
      [
        data.title,
        data.description,
        data.category,
        data.wishlist,
        primaryImage,
        ownerEmail,
      ]
    );

    try {
      for (let i = 0; i < normalizedImages.length; i += 1) {
        try {
          await connection.execute(
            "INSERT INTO item_images (item_id, image_url, sort_order) VALUES (?, ?, ?)",
            [result.insertId, normalizedImages[i], i]
          );
        } catch (orderColumnError) {
          const orderColumnMsg = String(orderColumnError?.message || "");
          if (!orderColumnMsg.includes("Unknown column")) {
            throw orderColumnError;
          }
          await connection.execute(
            "INSERT INTO item_images (item_id, image_url, ordering) VALUES (?, ?, ?)",
            [result.insertId, normalizedImages[i], i]
          );
        }
      }
    } catch (insertImageError) {
      const msg = String(insertImageError?.message || "");
      if (!msg.includes("doesn't exist") && !msg.includes("Unknown table") && !msg.includes("Unknown column")) {
        throw insertImageError;
      }
      // Fallback: ถ้ายังไม่สร้างตาราง item_images จะใช้รูปหลักจาก items.image_url อย่างเดียว
    }

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