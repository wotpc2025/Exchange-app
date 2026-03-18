import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const dbConfig = {
  host: "localhost",
  user: "root",
  password: "",
  database: "exchange",
};

export async function PUT(req, { params }) {
  const { id } = await params; // id ของ exchange_request
  try {
    const { status } = await req.json();
    const connection = await mysql.createConnection(dbConfig);

    // 1. อัปเดตสถานะใน exchange_requests
    await connection.execute(
      "UPDATE exchange_requests SET status = ? WHERE id = ?",
      [status, id]
    );

    // หมายเหตุ: ไม่เปลี่ยน items เป็น exchanged ตอน accepted แล้ว
    // จะเปลี่ยนเป็น exchanged เมื่อทั้ง 2 ฝ่ายกดยืนยันสำเร็จ (ดู /api/requests/[id]/confirm)

    await connection.end();
    return NextResponse.json({ message: "อัปเดตสถานะสำเร็จ" }); // ✅ ต้องส่ง JSON กลับไปเสมอ
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 }); // ✅ กรณี error ก็ต้องส่ง JSON
  }
}