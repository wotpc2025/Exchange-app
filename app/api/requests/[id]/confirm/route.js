import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const email = session.user.email;

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.execute(
      `SELECT id, item_id, owner_email, requester_email, status,
              owner_confirmed, requester_confirmed
       FROM exchange_requests
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const reqRow = rows[0];

    if (reqRow.status !== "accepted" && reqRow.status !== "completed") {
      await connection.release();
      return NextResponse.json(
        { error: "Request is not accepted" },
        { status: 400 }
      );
    }

    const isOwner = reqRow.owner_email === email;
    const isRequester = reqRow.requester_email === email;
    if (!isOwner && !isRequester) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isOwner) {
      await connection.execute(
        `UPDATE exchange_requests
         SET owner_confirmed = 1,
             owner_confirmed_at = COALESCE(owner_confirmed_at, NOW())
         WHERE id = ?`,
        [id]
      );
    } else {
      await connection.execute(
        `UPDATE exchange_requests
         SET requester_confirmed = 1,
             requester_confirmed_at = COALESCE(requester_confirmed_at, NOW())
         WHERE id = ?`,
        [id]
      );
    }

    const [afterRows] = await connection.execute(
      `SELECT id, item_id, status, owner_confirmed, requester_confirmed
       FROM exchange_requests
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const after = afterRows[0];

    const bothConfirmed = !!after.owner_confirmed && !!after.requester_confirmed;
    if (bothConfirmed && after.status !== "completed") {
      await connection.execute(
        `UPDATE exchange_requests
         SET status = 'completed',
             completed_at = NOW()
         WHERE id = ?`,
        [id]
      );

      await connection.execute(
        `UPDATE items
         SET status = 'exchanged'
         WHERE id = ?`,
        [after.item_id]
      );
    }

    await connection.release();
    return NextResponse.json({
      ok: true,
      confirmedBy: isOwner ? "owner" : "requester",
      bothConfirmed,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

