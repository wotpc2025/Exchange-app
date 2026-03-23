"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        กำลังตรวจสอบสิทธิ์...
      </div>
    );
  }

  if (!session || session.user.role !== "admin") {
    if (typeof window !== "undefined") {
      router.replace("/");
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gold-gradient">
            BUU Exchange
          </Link>
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>
      </nav>

      <div className="p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="min-w-0">
              <h1 className="text-3xl font-black text-amber-500">
                แผงควบคุมผู้ดูแลระบบ
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                ตรวจสอบและจัดการประกาศ, ผู้ใช้ และข้อความจากนักศึกษาได้ที่นี่
              </p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 items-stretch">
            <Link
              href="/admin/support"
              className="glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
            >
              <div>
                <h2 className="font-bold text-lg mb-2">กล่องข้อความ Student</h2>
                <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                  ดูและตอบคำถาม / ปัญหาจากนักศึกษาแบบแชท
                </p>
              </div>
            </Link>

          <Link
            href="/admin/announcements"
            className="glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
          >
            <div>
              <h2 className="font-bold text-lg mb-2">อนุมัติประกาศ</h2>
              <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                ตรวจสอบ / อนุมัติ / ไม่อนุมัติ / ถอดประกาศที่มีปัญหา
              </p>
            </div>
          </Link>

          <Link
            href="/admin/users"
            className="glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
          >
            <div>
              <h2 className="font-bold text-lg mb-2">จัดการผู้ใช้</h2>
              <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                ใบเหลือง / ใบแดง / แบนชั่วคราวหรือถาวรสำหรับ Student
              </p>
            </div>
          </Link>

          <Link
            href="/admin/complaints"
            className="glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
          >
            <div>
              <h2 className="font-bold text-lg mb-2">รายการร้องเรียน</h2>
              <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                ตรวจสอบหลักฐาน และปิดเคสการร้องเรียนประกาศ
              </p>
            </div>
          </Link>

          <Link
            href="/admin/reports"
            className="glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
          >
            <div>
              <h2 className="font-bold text-lg mb-2">รายงานผู้ใช้</h2>
              <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                ตรวจสอบรายงานผู้ใช้ และออกใบเหลือง/ใบแดงจากเคสเดียวกัน
              </p>
            </div>
          </Link>

          <Link
            href="/admin/audit-logs"
            className="glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
          >
            <div>
              <h2 className="font-bold text-lg mb-2">Audit Logs</h2>
              <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                ตรวจสอบประวัติการดำเนินการของแอดมินย้อนหลัง
              </p>
            </div>
          </Link>
        </div>
      </div>
      </div>
    </div>
  );
}

