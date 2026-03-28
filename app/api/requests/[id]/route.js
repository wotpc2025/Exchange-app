import { NextResponse } from "next/server";
import { getAppSession } from "@/lib/auth.js";
import { db } from "@/lib/db.js";

export async function PUT(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params; // id ของ exchange_request
  try {
    const { status } = await req.json();
    const nextStatus = String(status || "").toLowerCase();
    if (nextStatus === "accepted") {
      return NextResponse.json(
        {
          error:
            "การรับแลกต้องให้ทั้งสองฝ่ายกดยืนยัน — ใช้ POST /api/requests/[id]/negotiate-accept",
        },
        { status: 400 }
      );
    }

    const connection = await db.getConnection();

    const [rows] = await connection.execute(
      `SELECT id, status, owner_email, requester_email
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
    const email = session.user.email;
    const isOwner = row.owner_email === email;
    const isRequester = row.requester_email === email;
    if (!isOwner && !isRequester) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (nextStatus === "rejected") {
      if (String(row.status || "").toLowerCase() !== "pending") {
        await connection.release();
        return NextResponse.json(
          { error: "ปฏิเสธได้เฉพาะคำขอที่ยังรอตอบรับ" },
          { status: 400 }
        );
      }
      await connection.execute(
        `UPDATE exchange_requests
         SET status = 'rejected',
             owner_confirmed = 0,
             requester_confirmed = 0,
             owner_confirmed_at = NULL,
             requester_confirmed_at = NULL
         WHERE id = ?`,
        [id]
      );
    } else {
      await connection.release();
      return NextResponse.json({ error: "สถานะไม่รองรับ" }, { status: 400 });
    }

    // หมายเหตุ: ไม่เปลี่ยน items เป็น exchanged ตอน accepted แล้ว
    // จะเปลี่ยนเป็น exchanged เมื่อทั้ง 2 ฝ่ายกดยืนยันสำเร็จ (ดู /api/requests/[id]/confirm)

    await connection.release();
    return NextResponse.json({ message: "อัปเดตสถานะสำเร็จ" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}