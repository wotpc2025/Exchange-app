"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

const PAGE_SIZE = 20;

function dateText(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function NotificationsClient() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);

  const [typeFilter, setTypeFilter] = useState(searchParams?.get("type") || "all");
  const [unreadOnly, setUnreadOnly] = useState(searchParams?.get("unread") === "1");

  const page = useMemo(() => {
    const n = Number(searchParams?.get("page") || 1);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  }, [searchParams]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = async () => {
    if (!session) return;

    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(PAGE_SIZE));
      if (typeFilter !== "all") params.set("type", typeFilter);
      if (unreadOnly) params.set("onlyUnread", "true");

      const res = await fetch(`/api/notifications?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;

      setRows(Array.isArray(data.rows) ? data.rows : []);
      setTotal(Number(data.total || 0));
      setUnreadCount(Number(data.unreadCount || 0));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.replace("/login");
      return;
    }
    load();
  }, [status, session, page, typeFilter, unreadOnly]);

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    await load();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await load();
  };

  const updateQueryPage = (nextPage) => {
    const params = new URLSearchParams(searchParams?.toString() || "");
    params.set("page", String(nextPage));
    router.push(`/notifications?${params.toString()}`);
  };

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
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-amber-400">การแจ้งเตือนทั้งหมด</h1>
            <p className="text-sm text-slate-400 mt-1">ยังไม่ได้อ่าน {unreadCount} รายการ</p>
          </div>
          <button
            onClick={markAllRead}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-200 hover:bg-white/5"
          >
            อ่านทั้งหมด
          </button>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/40 mb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              if (page !== 1) updateQueryPage(1);
            }}
            className="bg-slate-900/50 border border-white/10 rounded-xl py-3 px-4 outline-none focus:border-amber-500/50 text-white"
          >
            <option value="all">ทุกประเภท</option>
            <option value="meeting">นัดหมาย</option>
            <option value="report_status">สถานะรายงาน</option>
            <option value="warning">ใบเตือน</option>
            <option value="ban">แบน</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-slate-300 px-3">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => {
                setUnreadOnly(e.target.checked);
                if (page !== 1) updateQueryPage(1);
              }}
            />
            แสดงเฉพาะที่ยังไม่อ่าน
          </label>

          <div className="text-xs text-slate-500 flex items-center justify-end px-2">
            หน้า {page}/{totalPages} · ทั้งหมด {total} รายการ
          </div>
        </div>

        <div className="space-y-3">
          {loading ? (
            <div className="text-slate-500 italic">กำลังโหลด...</div>
          ) : rows.length === 0 ? (
            <div className="glass-card p-8 rounded-2xl border border-white/5 bg-slate-900/40 text-slate-500 italic">
              ไม่พบการแจ้งเตือนตามตัวกรองที่เลือก
            </div>
          ) : (
            rows.map((n) => (
              <div key={n.id} className="glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/50">
                <div className="flex items-start gap-3">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${n.is_read ? "bg-slate-600" : "bg-amber-400"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-100">{n.title}</p>
                    {n.body ? <p className="text-sm text-slate-300 mt-1 whitespace-pre-wrap">{n.body}</p> : null}
                    <p className="text-[11px] text-slate-500 mt-1">{dateText(n.created_at)}</p>
                    <div className="mt-2 flex gap-3">
                      {n.link ? (
                        <Link
                          href={n.link}
                          onClick={() => markRead(n.id)}
                          className="text-[11px] font-black uppercase tracking-widest text-amber-300 hover:text-amber-200"
                        >
                          เปิด
                        </Link>
                      ) : null}
                      {!n.is_read ? (
                        <button
                          onClick={() => markRead(n.id)}
                          className="text-[11px] font-black uppercase tracking-widest text-slate-300 hover:text-white"
                        >
                          อ่านแล้ว
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-2">
          <button
            disabled={page <= 1}
            onClick={() => updateQueryPage(page - 1)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            ก่อนหน้า
          </button>
          <button
            disabled={page >= totalPages}
            onClick={() => updateQueryPage(page + 1)}
            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-200 hover:bg-white/5 disabled:opacity-50"
          >
            ถัดไป
          </button>
        </div>
      </main>
    </div>
  );
}
