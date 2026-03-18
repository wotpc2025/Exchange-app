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
      `SELECT i.*,
              (SELECT COUNT(*) FROM item_complaints c WHERE c.item_id = i.id) AS complaint_count
       FROM items i
       ORDER BY FIELD(i.approval_status, 'pending','approved','rejected','removed'),
                i.created_at DESC`
    );
    await connection.end();
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

