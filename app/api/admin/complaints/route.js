import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession, requireAdmin } from "../../../../lib/auth.js";

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

export async function GET() {
  const session = await getAppSession();
  if (!session || !requireAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);
    const [rows] = await connection.execute(
      `SELECT c.*,
              i.title AS item_title,
              i.owner_email,
              u.name AS student_name,
              u.id AS student_id,
              closed.name AS closed_by_admin_name
       FROM item_complaints c
       JOIN items i ON i.id = c.item_id
       LEFT JOIN users u ON u.email = c.student_email
       LEFT JOIN users closed ON closed.id = c.closed_by_admin_id
       ORDER BY FIELD(c.status, 'open','closed'), c.created_at DESC, c.id DESC`
    );
    await connection.end();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

