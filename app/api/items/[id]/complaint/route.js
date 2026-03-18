import { NextResponse } from "next/server";
import { getAppSession } from "../../../../../lib/auth.js";
import { db } from "../../../../../lib/db.js";

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reason, evidenceText, evidenceImageUrl } = await req.json();

  try {
    const connection = await db.getConnection();
    await connection.execute(
      "INSERT INTO item_complaints (item_id, student_email, reason, evidence_text, evidence_image_url, status) VALUES (?, ?, ?, ?, ?, 'open')",
      [
        id,
        session.user.email,
        reason || null,
        evidenceText || null,
        evidenceImageUrl || null,
      ]
    );
    await connection.release();
    return NextResponse.json({ message: "created" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

