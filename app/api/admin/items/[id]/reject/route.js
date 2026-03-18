import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getAppSession, requireAdmin } from "../../../../../../lib/auth.js";

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

  try {
    const connection = await mysql.createConnection(dbConfig);
    await connection.execute(
      "UPDATE items SET approval_status = 'rejected' WHERE id = ?",
      [id]
    );
    await connection.end();
    return NextResponse.json({ message: "rejected" });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

