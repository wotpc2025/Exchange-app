"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

function actionLabel(action) {
  const map = {
    report_status_updated: "อัปเดตสถานะรายงาน",
    report_warn_yellow: "ออกใบเหลืองจากรายงาน",
    report_warn_red: "ออกใบแดงจากรายงาน",
    user_warn_yellow: "ออกใบเหลือง",
    user_warn_red: "ออกใบแดง",
    user_banned: "แบนผู้ใช้",
    user_unbanned: "ปลดแบนผู้ใช้",
    complaint_closed: "ปิดเคสร้องเรียนประกาศ",
  };
  return map[action] || action || "-";
}

export default function AdminAuditLogsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/audit-logs?limit=200");
      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session || session.user.role !== "admin") {
      router.replace("/");
      return;
    }
    load();
  }, [session, status]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const text = [
        r.action_type,
        r.target_type,
        r.target_id,
        r.detail,
        r.admin_name,
        r.admin_email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return text.includes(term);
    });
  }, [rows, q]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        กำลังโหลด...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gold-gradient">
            BUU Exchange
          </Link>
          <div className="flex items-center gap-3">
            <NotificationBell />
            <Link href="/admin" className="text-slate-400 hover:text-white transition-colors">
              ← กลับหน้า Admin
            </Link>
          </div>
        </div>
      </nav>

      <div className="p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="min-w-0">
              <h1 className="text-3xl font-black text-amber-500">ประวัติการทำงานแอดมิน</h1>
              <p className="text-sm text-slate-400 mt-1">ติดตามว่าแอดมินคนไหนดำเนินการอะไร เมื่อไหร่</p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-white/5 bg-slate-900/40 mb-6 flex gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหา action / แอดมิน / target / detail..."
              className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500/50 transition-all text-white"
            />
            <button
              onClick={load}
              className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-200 hover:bg-white/5"
            >
              รีเฟรช
            </button>
          </div>

          {loading ? (
            <div className="text-slate-500 italic">กำลังดึงข้อมูล...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 italic glass-card p-8 rounded-[30px] border border-white/5 bg-slate-900/30">
              ยังไม่มีประวัติการทำงาน
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((r) => (
                <div key={r.id} className="glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-200 font-semibold">{actionLabel(r.action_type)}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        โดย {r.admin_name || r.admin_email || `admin#${r.admin_user_id || "?"}`}
                        {"  "}·{"  "}
                        target: {r.target_type || "-"} #{r.target_id || "-"}
                      </p>
                      {r.detail ? <p className="text-xs text-slate-500 mt-1">detail: {r.detail}</p> : null}
                    </div>
                    <p className="text-[11px] text-slate-500">{r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
