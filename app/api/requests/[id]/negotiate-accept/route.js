import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

/** ขณะ status = pending: ให้เจ้าของกับผู้ขอแลกกดยืนยันทีละฝ่าย ครบสองฝ่ายถึงจะเป็น accepted */
export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const email = session.user.email;

  try {
    const connection = await db.getConnection();

    const [rows] = await connection.execute(
      `SELECT id, status, owner_email, requester_email, owner_confirmed, requester_confirmed
       FROM exchange_requests
       WHERE id = ?
       LIMIT 1`,
      [id]
    );

    if (rows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const row = rows[0];
    if (String(row.status || "").toLowerCase() !== "pending") {
      await connection.release();
      return NextResponse.json(
        { error: "คำขอนี้ไม่ได้อยู่ในสถานะรอตอบรับ" },
        { status: 400 }
      );
    }

    const isOwner = row.owner_email === email;
    const isRequester = row.requester_email === email;
    if (!isOwner && !isRequester) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (isOwner && Number(row.owner_confirmed) === 1) {
      await connection.release();
      return NextResponse.json({ error: "คุณยืนยันรับแลกไปแล้ว รออีกฝ่ายยืนยัน" }, { status: 400 });
    }
    if (isRequester && Number(row.requester_confirmed) === 1) {
      await connection.release();
      return NextResponse.json({ error: "คุณยืนยันรับแลกไปแล้ว รออีกฝ่ายยืนยัน" }, { status: 400 });
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
      `SELECT status, owner_confirmed, requester_confirmed
       FROM exchange_requests
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const after = afterRows[0];
    const both = Number(after.owner_confirmed) === 1 && Number(after.requester_confirmed) === 1;

    if (both) {
      await connection.execute(
        `UPDATE exchange_requests
         SET status = 'accepted',
             owner_confirmed = 0,
             requester_confirmed = 0,
             owner_confirmed_at = NULL,
             requester_confirmed_at = NULL
         WHERE id = ?`,
        [id]
      );
    }

    const [finalRows] = await connection.execute(
      `SELECT status, owner_confirmed, requester_confirmed
       FROM exchange_requests
       WHERE id = ?
       LIMIT 1`,
      [id]
    );
    const finalRow = finalRows[0];

    await connection.release();
    return NextResponse.json({
      ok: true,
      status: finalRow.status,
      bothNegotiationAccepted: both,
      ownerConfirmed: Number(finalRow.owner_confirmed) === 1,
      requesterConfirmed: Number(finalRow.requester_confirmed) === 1,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
