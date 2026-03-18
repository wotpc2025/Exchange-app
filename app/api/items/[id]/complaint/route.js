import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession } from "../../../../../lib/auth.js";

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { reason, evidenceText, evidenceImageUrl } = await req.json();

  try {
    const connection = await mysql.createConnection(dbConfig);
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
    await connection.end();
    return NextResponse.json({ message: "created" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

