import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession, requireAdmin } from "../../../../../../../lib/auth.js";

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

export async function POST(req, { params }) {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const { reason } = await req.json().catch(() => ({}));

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      "INSERT INTO user_warnings (user_id, type, reason, issued_by_admin_id) VALUES (?, 'red', ?, ?)",
      [id, reason || null, session.user.id || null]
    );
    await connection.end();
    return NextResponse.json({ message: "red_given" }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

