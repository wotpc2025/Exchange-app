import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession } from "@/lib/auth.js";

export async function GET(req, { params }) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const connection = await db.getConnection();

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
       WHERE id = ?`,
      [id]
    );

    if (userRows.length === 0) {
      await connection.release();
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const dbUser = userRows[0];

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

