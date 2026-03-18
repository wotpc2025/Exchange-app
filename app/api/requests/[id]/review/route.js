import { NextResponse } from "next/server";
import { getAppSession } from "../../../../../lib/auth.js";
import { db } from "../../../../../lib/db.js";

function clampRating(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  if (x < 1) return 1;
  if (x > 5) return 5;
  return Math.round(x);
}

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params; // request id
  const email = session.user.email;

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const punctuality = clampRating(body?.punctuality);
  const accuracy = clampRating(body?.accuracy);
  const politeness = clampRating(body?.politeness);
  const comment = typeof body?.comment === "string" ? body.comment.trim() : null;

  if (!punctuality || !accuracy || !politeness) {
    return NextResponse.json({ error: "ratings required (1-5)" }, { status: 400 });
  }

  try {
    const connection = await db.getConnection();

    const [reqRows] = await connection.execute(
      `SELECT r.id, r.status, r.owner_email, r.requester_email,
              owner.id AS owner_id,
              requester.id AS requester_id
       FROM exchange_requests r
       JOIN users owner ON owner.email = r.owner_email
       JOIN users requester ON requester.email = r.requester_email
       WHERE r.id = ?
       LIMIT 1`,
      [id]
    );

    if (reqRows.length === 0) {
      await connection.release();
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const r = reqRows[0];
    if (r.status !== "completed") {
      await connection.release();
      return NextResponse.json({ error: "Exchange not completed" }, { status: 400 });
    }

    const isOwner = r.owner_email === email;
    const isRequester = r.requester_email === email;
    if (!isOwner && !isRequester) {
      await connection.release();
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const reviewerId = isOwner ? r.owner_id : r.requester_id;
    const reviewedId = isOwner ? r.requester_id : r.owner_id;

    await connection.execute(
      `INSERT INTO exchange_reviews
        (request_id, reviewer_user_id, reviewed_user_id, punctuality, accuracy, politeness, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, reviewerId, reviewedId, punctuality, accuracy, politeness, comment]
    );

    // อัปเดต trust_score ของคนที่โดนรีวิวเป็นค่าเฉลี่ย (1-5) จากรีวิวทั้งหมด
    const [avgRows] = await connection.execute(
      `SELECT AVG((punctuality + accuracy + politeness) / 3) AS avg_score
       FROM exchange_reviews
       WHERE reviewed_user_id = ?`,
      [reviewedId]
    );
    const avg = avgRows?.[0]?.avg_score ?? null;
    const trustScore = avg == null ? 0 : Math.round(Number(avg));

    await connection.execute(
      `UPDATE users SET trust_score = ? WHERE id = ?`,
      [trustScore, reviewedId]
    );

    await connection.release();
    return NextResponse.json({ ok: true, trustScore });
  } catch (error) {
    // duplicate review (uniq constraint)
    if (String(error?.code) === "ER_DUP_ENTRY") {
      return NextResponse.json({ error: "Already reviewed" }, { status: 400 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

