"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

function dateText(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const res = await fetch("/api/notifications");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setRows(Array.isArray(data.rows) ? data.rows : []);
      setUnread(Number(data.unreadCount || 0));
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 15000);
    return () => clearInterval(t);
  }, []);

  const markRead = async (id) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    await load(true);
  };

  const markAllRead = async () => {
    await fetch("/api/notifications/read-all", { method: "POST" });
    await load(true);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative bg-slate-800/80 p-3 rounded-2xl border border-white/5 hover:border-amber-500/50 transition-all text-xl"
        title="แจ้งเตือน"
      >
        🔔
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-amber-500 border-2 border-[#020617] text-[9px] font-black text-slate-950">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[360px] max-w-[90vw] rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-md shadow-xl z-50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <p className="text-sm font-black text-amber-300">การแจ้งเตือน</p>
            <button
              onClick={markAllRead}
              className="text-[10px] uppercase font-black tracking-widest text-slate-300 hover:text-white"
            >
              อ่านทั้งหมด
            </button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="p-4 text-sm text-slate-500 italic">กำลังโหลด...</p>
            ) : rows.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 italic">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              rows.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-white/5 last:border-b-0">
                  <div className="flex items-start gap-2">
                    {!n.is_read ? <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" /> : <span className="mt-1 h-2 w-2 rounded-full bg-transparent" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-100 truncate">{n.title}</p>
                      {n.body ? <p className="text-xs text-slate-400 mt-1 whitespace-pre-wrap">{n.body}</p> : null}
                      <p className="text-[10px] text-slate-500 mt-1">{dateText(n.created_at)}</p>
                      <div className="mt-2 flex gap-2">
                        {n.link ? (
                          <Link
                            href={n.link}
                            onClick={() => markRead(n.id)}
                            className="text-[10px] uppercase font-black tracking-widest text-amber-300 hover:text-amber-200"
                          >
                            เปิด
                          </Link>
                        ) : null}
                        {!n.is_read ? (
                          <button
                            onClick={() => markRead(n.id)}
                            className="text-[10px] uppercase font-black tracking-widest text-slate-300 hover:text-white"
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
        </div>
      )}
    </div>
  );
}
