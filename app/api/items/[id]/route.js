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
    if (rows.length === 0) {
      await connection.release();
      return NextResponse.json({ message: "ไม่พบข้อมูลสินค้า" }, { status: 404 });
    }

    const item = rows[0];

    let images = [];
    try {
      let imageRows;
      try {
        const [rowsBySort] = await connection.execute(
          "SELECT image_url FROM item_images WHERE item_id = ? ORDER BY sort_order ASC, id ASC",
          [id]
        );
        imageRows = rowsBySort;
      } catch (orderColumnError) {
        const orderColumnMsg = String(orderColumnError?.message || "");
        if (!orderColumnMsg.includes("Unknown column")) {
          throw orderColumnError;
        }
        const [rowsByOrdering] = await connection.execute(
          "SELECT image_url FROM item_images WHERE item_id = ? ORDER BY ordering ASC, id ASC",
          [id]
        );
        imageRows = rowsByOrdering;
      }

      images = Array.isArray(imageRows) ? imageRows.map((r) => r.image_url).filter(Boolean) : [];
    } catch (imageError) {
      const msg = String(imageError?.message || "");
      if (!msg.includes("doesn't exist") && !msg.includes("Unknown table")) {
        throw imageError;
      }
    }

    if (!images.length && item.image_url) {
      images = [item.image_url];
    }

    await connection.release();
    return NextResponse.json({ ...item, images });
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
    const { title, description, category, wishlist, image_url, images_data, status, exchanged_with_email } = body;

    // Determine images array (prefer images_data, fallback to image_url)
    const imagesArr = Array.isArray(images_data) ? images_data.filter((v) => typeof v === "string" && v.trim() !== "").slice(0, 8) : (image_url ? [image_url] : []);
    const mainImage = imagesArr[0] || image_url || null;

    connection = await db.getConnection();

    try {
      // Update main item fields (main image is first in array)
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
          mainImage || null,
          status || null,
          status || null,
          exchanged_with_email || null,
          status || null,
          status || null,
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

      // Fallback for old schema
      await connection.execute(
        `UPDATE items SET 
          title = COALESCE(?, title), 
          description = COALESCE(?, description), 
          category = COALESCE(?, category), 
          wishlist = COALESCE(?, wishlist), 
          image_url = COALESCE(?, image_url),
          status = COALESCE(?, status)
        WHERE id = ?`,
        [title || null, description || null, category || null, wishlist || null, mainImage || null, status || null, id]
      );
    }

    // --- Update item_images table ---
    if (Array.isArray(imagesArr) && imagesArr.length > 0) {
      try {
        // Remove old images
        await connection.execute("DELETE FROM item_images WHERE item_id = ?", [id]);
        // Insert new images
        for (let i = 0; i < imagesArr.length; i += 1) {
          try {
            await connection.execute(
              "INSERT INTO item_images (item_id, image_url, sort_order) VALUES (?, ?, ?)",
              [id, imagesArr[i], i]
            );
          } catch (orderColumnError) {
            const orderColumnMsg = String(orderColumnError?.message || "");
            if (!orderColumnMsg.includes("Unknown column")) {
              throw orderColumnError;
            }
            await connection.execute(
              "INSERT INTO item_images (item_id, image_url, ordering) VALUES (?, ?, ?)",
              [id, imagesArr[i], i]
            );
          }
        }
      } catch (imgUpdateError) {
        const msg = String(imgUpdateError?.message || "");
        if (!msg.includes("doesn't exist") && !msg.includes("Unknown table") && !msg.includes("Unknown column")) {
          throw imgUpdateError;
        }
        // Fallback: ignore if item_images table doesn't exist
      }
    }

    return NextResponse.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) await connection.release();
  }
}