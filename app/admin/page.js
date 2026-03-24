"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [counts, setCounts] = useState({
    support: 0,
    announcements: 0,
    users: 0,
    complaints: 0,
    reports: 0,
    auditLogsToday: 0,
  });

  useEffect(() => {
    if (!session || session.user?.role !== "admin") return;

    const loadCounts = async () => {
      try {
        const [supportRes, announcementsRes, usersRes, complaintsRes, reportsRes, auditRes] =
          await Promise.all([
            fetch("/api/support/conversations"),
            fetch("/api/admin/items"),
            fetch("/api/admin/users"),
            fetch("/api/admin/complaints"),
            fetch("/api/admin/reports"),
            fetch("/api/admin/audit-logs?limit=300"),
          ]);

        const [supportData, announcementsData, usersData, complaintsData, reportsData, auditData] =
          await Promise.all([
            supportRes.json().catch(() => []),
            announcementsRes.json().catch(() => []),
            usersRes.json().catch(() => []),
            complaintsRes.json().catch(() => []),
            reportsRes.json().catch(() => []),
            auditRes.json().catch(() => []),
          ]);

        const support = (Array.isArray(supportData) ? supportData : []).filter(
          (c) => String(c?.status || "").toLowerCase() === "open"
        ).length;
        const announcements = (Array.isArray(announcementsData) ? announcementsData : []).filter(
          (i) =>
            String(i?.approval_status || "").toLowerCase() === "pending" &&
            String(i?.status || "").toLowerCase() !== "exchanged"
        ).length;
        const users = (Array.isArray(usersData) ? usersData : []).filter(
          (u) =>
            !u?.active_ban_type &&
            Number(u?.red_count || 0) > 0
        ).length;
        const complaints = (Array.isArray(complaintsData) ? complaintsData : []).filter(
          (c) => String(c?.status || "").toLowerCase() === "open"
        ).length;
        const reports = (Array.isArray(reportsData) ? reportsData : []).filter(
          (r) => String(r?.status || "").toLowerCase() === "open"
        ).length;
        const today = new Date().toDateString();
        const auditLogsToday = (Array.isArray(auditData) ? auditData : []).filter((a) => {
          if (!a?.created_at) return false;
          return new Date(a.created_at).toDateString() === today;
        }).length;

        setCounts({
          support,
          announcements,
          users,
          complaints,
          reports,
          auditLogsToday,
        });
      } catch {
        setCounts({
          support: 0,
          announcements: 0,
          users: 0,
          complaints: 0,
          reports: 0,
          auditLogsToday: 0,
        });
      }
    };

    loadCounts();
  }, [session]);

  const cards = useMemo(
    () => [
      {
        href: "/admin/support",
        title: "กล่องข้อความ Student",
        description: "ดูและตอบคำถาม / ปัญหาจากนักศึกษาแบบแชท",
        count: counts.support,
      },
      {
        href: "/admin/announcements",
        title: "อนุมัติประกาศ",
        description: "ตรวจสอบ / อนุมัติ / ไม่อนุมัติ / ถอดประกาศที่มีปัญหา",
        count: counts.announcements,
      },
      {
        href: "/admin/users",
        title: "จัดการผู้ใช้",
        description: "ใบเหลือง / ใบแดง / แบนชั่วคราวหรือถาวรสำหรับ Student",
        count: counts.users,
      },
      {
        href: "/admin/complaints",
        title: "รายการร้องเรียน",
        description: "ตรวจสอบหลักฐาน และปิดเคสการร้องเรียนประกาศ",
        count: counts.complaints,
      },
      {
        href: "/admin/reports",
        title: "รายงานผู้ใช้",
        description: "ตรวจสอบรายงานผู้ใช้ และออกใบเหลือง/ใบแดงจากเคสเดียวกัน",
        count: counts.reports,
      },
      {
        href: "/admin/audit-logs",
        title: "Audit Logs",
        description: "ตรวจสอบประวัติการดำเนินการของแอดมินย้อนหลัง",
        count: counts.auditLogsToday,
      },
    ],
    [counts]
  );

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
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← กลับหน้าหลัก
            </Link>
          </div>
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
            {cards.map((card) => (
              <Link
                key={card.href}
                href={card.href}
                className="relative glass-card p-6 rounded-3xl border border-white/5 hover:border-amber-500/50 hover:-translate-y-1 transition-all bg-slate-900/60 h-full min-h-[126px] flex flex-col justify-between"
              >
                <span
                  className={`absolute top-4 right-4 min-w-6 h-6 px-2 rounded-full text-[11px] font-black flex items-center justify-center border ${
                    card.count > 0
                      ? "bg-amber-500 text-slate-950 border-amber-300"
                      : "bg-slate-800/80 text-slate-400 border-white/10"
                  }`}
                >
                  {card.count > 99 ? "99+" : card.count}
                </span>
                <div>
                  <h2 className="font-bold text-lg mb-2">{card.title}</h2>
                  <p className="text-sm text-slate-400 min-h-[40px] line-clamp-2">
                    {card.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
      </div>
      </div>
    </div>
  );
}

