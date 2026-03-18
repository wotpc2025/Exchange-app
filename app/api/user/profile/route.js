import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route.js";
import { db } from "@/lib/db.js";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connection = await db.getConnection();

    // ข้อมูลผู้ใช้จากตาราง users (รวมฟิลด์ที่เพิ่มใหม่สำหรับโปรไฟล์)
    const [userRows] = await connection.execute(
      `SELECT id, email, name, image, role,
              faculty,
              major,
              contact_info,
              trust_score,
              admin_success_cases,
              admin_likes_received,
              admin_since
       FROM users
       WHERE email = ?`,
      [session.user.email]
    );

    if (userRows.length === 0) {
      await connection.release();
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const dbUser = userRows[0];

    // ประวัติใบเหลือง/ใบแดง
    const [warningRows] = await connection.execute(
      `SELECT type, COUNT(*) AS count
       FROM user_warnings
       WHERE user_id = ?
       GROUP BY type`,
      [dbUser.id]
    );

    let yellowCount = 0;
    let redCount = 0;
    for (const row of warningRows) {
      if (row.type === "yellow") yellowCount = row.count;
      if (row.type === "red") redCount = row.count;
    }

    // รายการประกาศของผู้ใช้
    const [items] = await connection.execute(
      "SELECT * FROM items WHERE owner_email = ?",
      [dbUser.email]
    );

    await connection.release();

    const available = items.filter((i) => i.status === "available").length;
    const pending = items.filter((i) => i.status === "pending").length;
    const exchanged = items.filter((i) => i.status === "exchanged").length;

    return NextResponse.json({
      user: {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        image: dbUser.image,
        role: dbUser.role,
        faculty: dbUser.faculty,
        major: dbUser.major,
        contactInfo: dbUser.contact_info,
        trustScore: dbUser.trust_score,
        adminSuccessCases: dbUser.admin_success_cases,
        adminLikesReceived: dbUser.admin_likes_received,
        adminSince: dbUser.admin_since,
      },
      stats: {
        items: {
          available,
          pending,
          exchanged,
        },
        warnings: {
          yellow: yellowCount,
          red: redCount,
        },
      },
      items,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { faculty, major, contactInfo } = body || {};

  // อนุญาตให้ student แก้ทั้ง 3 ช่อง, admin แก้เฉพาะ contactInfo
  const isAdmin = session.user?.role === "admin";

  const updates = [];
  const params = [];

  if (!isAdmin) {
    if (typeof faculty === "string") {
      updates.push("faculty = ?");
      params.push(faculty);
    }
    if (typeof major === "string") {
      updates.push("major = ?");
      params.push(major);
    }
  }

  if (typeof contactInfo === "string") {
    updates.push("contact_info = ?");
    params.push(contactInfo);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const connection = await db.getConnection();

    await connection.execute(
      `UPDATE users SET ${updates.join(", ")} WHERE email = ?`,
      [...params, session.user.email]
    );

    await connection.release();

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}