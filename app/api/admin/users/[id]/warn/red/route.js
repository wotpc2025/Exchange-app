import { NextResponse } from "next/server";
import { enforceRateLimit, requireSessionOrThrow } from "@/lib/api-guards.js";

/**
 * ใบแดงออกได้เฉพาะอัตโนมัติเมื่อสะสมใบเหลืองครบ 2 ใบ — ดู POST /warn/yellow
 * ไม่อนุญาตให้แอดมินออกใบแดงโดยตรง
 */
export async function POST(_req, { params }) {
  const auth = await requireSessionOrThrow({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const limitResponse = enforceRateLimit(req, {
    scope: "admin-warn-red",
    userKey: session.user.email || "admin",
    limit: 80,
    windowMs: 60 * 1000,
  });
  if (limitResponse) return limitResponse;

  await params;

  return NextResponse.json(
    {
      error:
        "ไม่สามารถออกใบแดงโดยตรง — ให้ออกใบเหลืองเท่านั้น เมื่อครบ 2 ใบเหลืองระบบจะออกใบแดงอัตโนมัติ",
    },
    { status: 400 }
  );
}
