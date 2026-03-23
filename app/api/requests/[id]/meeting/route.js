import { NextResponse } from "next/server";
import { db } from "@/lib/db.js";
import { createNotificationsForEmails } from "@/lib/notifications.js";
import { sanitizeText } from "@/lib/security.js";
import { enforceRateLimit, parseJson, requireSessionOrThrow } from "@/lib/api-guards.js";

// GET: ดึงนัดหมายของ request นี้
export async function GET(req, { params }) {
  const auth = await requireSessionOrThrow();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const { id } = await params;

  try {
    const connection = await db.getConnection();

    // ตรวจสอบว่า user เป็นส่วนหนึ่งของ request นี้
    const [reqRows] = await connection.execute(
      "SELECT owner_email, requester_email FROM exchange_requests WHERE id = ? LIMIT 1",
      [id]
    );

    if (reqRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = reqRows[0];
    if (r.owner_email !== session.user.email && r.requester_email !== session.user.email) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [meetingRows] = await connection.execute(
      `SELECT m.*, u.name AS proposed_by_name
       FROM exchange_meetings m
       JOIN users u ON u.email = m.proposed_by
       WHERE m.request_id = ?
       ORDER BY m.created_at DESC
       LIMIT 1`,
      [id]
    );

    await connection.release();
    return NextResponse.json({ meeting: meetingRows[0] || null });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: เสนอนัดหมายใหม่
export async function POST(req, { params }) {
  const auth = await requireSessionOrThrow();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "meeting-post",
    userKey: session.user.email || "anon",
    limit: 8,
    windowMs: 10 * 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const { id } = await params;

  const body = await parseJson(req, {});

  const location = sanitizeText(body?.location, { maxLen: 300, allowNewlines: false });
  const meetTime = body?.meetTime;
  const parsedMeetTime = new Date(meetTime);

  if (!location || !meetTime || Number.isNaN(parsedMeetTime.getTime())) {
    return NextResponse.json({ error: "location and meetTime are required" }, { status: 400 });
  }

  if (parsedMeetTime.getTime() < Date.now() - 60 * 1000) {
    return NextResponse.json({ error: "meetTime must be in the future" }, { status: 400 });
  }

  try {
    const connection = await db.getConnection();

    const [reqRows] = await connection.execute(
      "SELECT owner_email, requester_email, status FROM exchange_requests WHERE id = ? LIMIT 1",
      [id]
    );

    if (reqRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = reqRows[0];
    if (r.owner_email !== session.user.email && r.requester_email !== session.user.email) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (r.status !== "accepted" && r.status !== "pending") {
      await connection.release();
      return NextResponse.json({ error: "Cannot propose meeting at this stage" }, { status: 400 });
    }

    // ยกเลิกนัดเดิมที่ยังไม่ได้รับการยืนยัน
    await connection.execute(
      "UPDATE exchange_meetings SET status = 'cancelled' WHERE request_id = ? AND status = 'proposed'",
      [id]
    );

    const [result] = await connection.execute(
      "INSERT INTO exchange_meetings (request_id, proposed_by, location, meet_time, status) VALUES (?, ?, ?, ?, 'proposed')",
      [id, session.user.email, location, parsedMeetTime]
    );

    const targetEmail = r.owner_email === session.user.email ? r.requester_email : r.owner_email;
    await createNotificationsForEmails({
      emails: [targetEmail],
      type: "meeting",
      title: "มีการเสนอนัดหมายใหม่",
      body: `คำขอ #${id}: ${location.trim()} · ${new Date(meetTime).toLocaleString("th-TH")}`,
      link: `/chat/${id}`,
      connection,
    });

    await connection.release();
    return NextResponse.json({ id: result.insertId }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: ยืนยัน / ยกเลิก / ทำเสร็จนัดหมาย
export async function PUT(req, { params }) {
  const auth = await requireSessionOrThrow();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "meeting-put",
    userKey: session.user.email || "anon",
    limit: 20,
    windowMs: 10 * 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  const { id } = await params;

  const body = await parseJson(req, {});

  const { meetingId, action } = body || {};
  if (!meetingId || !["confirm", "cancel", "done"].includes(action)) {
    return NextResponse.json({ error: "meetingId and valid action required" }, { status: 400 });
  }

  try {
    const connection = await db.getConnection();

    const [reqRows] = await connection.execute(
      "SELECT owner_email, requester_email FROM exchange_requests WHERE id = ? LIMIT 1",
      [id]
    );

    if (reqRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = reqRows[0];
    if (r.owner_email !== session.user.email && r.requester_email !== session.user.email) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const newStatus = action === "confirm" ? "confirmed" : action === "cancel" ? "cancelled" : "done";

    await connection.execute(
      "UPDATE exchange_meetings SET status = ? WHERE id = ? AND request_id = ?",
      [newStatus, meetingId, id]
    );

    const targetEmail = r.owner_email === session.user.email ? r.requester_email : r.owner_email;
    const statusText =
      action === "confirm"
        ? "ยืนยันนัดแล้ว"
        : action === "cancel"
          ? "ยกเลิกนัดแล้ว"
          : "ทำเครื่องหมายว่านัดเสร็จสิ้นแล้ว";

    await createNotificationsForEmails({
      emails: [targetEmail],
      type: "meeting",
      title: "อัปเดตสถานะนัดหมาย",
      body: `คำขอ #${id}: อีกฝ่าย${statusText}`,
      link: `/chat/${id}`,
      connection,
    });

    await connection.release();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
