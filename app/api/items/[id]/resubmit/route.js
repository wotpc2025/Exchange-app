import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { getAppSession } from "@/lib/auth.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const userEmail = session.user.email;

  let connection;
  try {
    connection = await db.getConnection();

    const [rows] = await connection.execute(
      `SELECT id, owner_email, approval_status
       FROM items
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const item = rows[0];
    if (item.owner_email !== userEmail) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const approvalStatus = String(item.approval_status || "").toLowerCase();
    if (approvalStatus !== "rejected" && approvalStatus !== "reject") {
      return NextResponse.json(
        { error: "Only rejected items can be resubmitted" },
        { status: 400 }
      );
    }

    await connection.execute(
      `UPDATE items
       SET approval_status = 'pending'
       WHERE id = ?`,
      [id]
    );

    return NextResponse.json({ message: "resubmitted" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    if (connection) {
      await connection.release();
    }
  }
}
