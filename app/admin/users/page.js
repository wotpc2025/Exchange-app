"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function formatBanLabel(type, endAt) {
  if (!type) return "ไม่แบน";
  if (type === "permanent") return "แบนถาวร";
  if (!endAt) return "แบนชั่วคราว";
  return `แบนถึง ${new Date(endAt).toLocaleString("th-TH")}`;
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
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
    if (!term) return users;
    return users.filter(
      (u) =>
        (u.email || "").toLowerCase().includes(term) ||
        (u.name || "").toLowerCase().includes(term)
    );
  }, [users, q]);

  const post = async (id, path, body) => {
    setBusyId(id);
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ทำรายการไม่สำเร็จ");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const giveYellow = async (u) => {
    const reason = prompt("เหตุผลใบเหลือง (ไม่ใส่ก็ได้):") || "";
    await post(u.id, `/api/admin/users/${u.id}/warn/yellow`, { reason });
  };

  const giveRed = async (u) => {
    const reason = prompt("เหตุผลใบแดง (ไม่ใส่ก็ได้):") || "";
    await post(u.id, `/api/admin/users/${u.id}/warn/red`, { reason });
  };

  const banUser = async (u) => {
    if ((u.red_count || 0) < 1) {
      alert("ต้องมีใบแดงก่อนถึงจะแบนได้");
      return;
    }

    const type = prompt(
      "พิมพ์ประเภทแบน: temporary หรือ permanent",
      "temporary"
    );
    if (type !== "temporary" && type !== "permanent") return;

    let amount;
    let unit;
    if (type === "temporary") {
      amount = prompt("จำนวน (ตัวเลข):", "7");
      unit = prompt("หน่วย: day หรือ month หรือ year", "day");
      if (!amount || !unit) return;
    }

    const reason = prompt("เหตุผลแบน (ไม่ใส่ก็ได้):") || "";

    await post(u.id, `/api/admin/users/${u.id}/ban`, {
      ban_type: type,
      amount,
      unit,
      reason,
    });
  };

  const unbanUser = async (u) => {
    if (!confirm(`ปลดแบนผู้ใช้ ${u.email}?`)) return;
    await post(u.id, `/api/admin/users/${u.id}/unban`);
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
              <h1 className="text-3xl font-black text-amber-500">
                จัดการผู้ใช้
              </h1>
              <p className="ttext-sm text-slate-400 mt-1">
                ให้ใบเหลือง/ใบแดง และแบนผู้ใช้ role student (ใบเหลือง 2 ใบ → ใบแดงอัตโนมัติ)
              </p>
          </div>
        </div>

        <div className="glass-card p-4 rounded-3xl border border-white/5 bg-slate-900/40 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ค้นหา email หรือชื่อ..."
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
            ไม่พบผู้ใช้
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((u) => {
              const isBusy = busyId === u.id;
              const bannedLabel = formatBanLabel(
                u.active_ban_type,
                u.active_ban_end_at
              );
              const isBanned = !!u.active_ban_type;

              const displayName = u.name || u.email || "";
              const fallbackUrl =
                "https://ui-avatars.com/api/?background=0f172a&color=fbbf24&name=" +
                encodeURIComponent(displayName);
              const avatarUrl =
                u.image && u.image.trim() !== "" ? u.image : fallbackUrl;

              return (
                <div
                  key={u.id}
                  className="glass-card p-5 rounded-[30px] border border-white/5 bg-slate-900/50"
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/10 bg-slate-800 shrink-0">
                        <img
                          src={avatarUrl}
                          alt={u.email}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            if (e.currentTarget.src !== fallbackUrl) {
                              e.currentTarget.src = fallbackUrl;
                            }
                          }}
                        />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/users/${u.id}`}
                          className="block hover:underline underline-offset-2"
                        >
                          <p className="font-bold text-white truncate">
                            {u.email}
                          </p>
                          <p className="text-xs text-slate-400 truncate">
                            {u.name || "—"}
                          </p>
                        </Link>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                            Yellow: {u.yellow_count || 0}
                          </span>
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest bg-red-500/10 text-red-300 border-red-500/30">
                            Red: {u.red_count || 0}
                          </span>
                          <span
                            className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                              isBanned
                                ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                                : "bg-green-500/10 text-green-300 border-green-500/30"
                            }`}
                          >
                            {bannedLabel}
                          </span>
                        </div>
                        {u.active_ban_reason ? (
                          <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                            เหตุผลแบน: {u.active_ban_reason}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        disabled={isBusy}
                        onClick={() => giveYellow(u)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500 hover:text-slate-950 transition-all disabled:opacity-60"
                      >
                        ให้ใบเหลือง
                      </button>
                      <button
                        disabled={isBusy}
                        onClick={() => giveRed(u)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white transition-all disabled:opacity-60"
                      >
                        ให้ใบแดง
                      </button>

                      <button
                        disabled={isBusy}
                        onClick={() => banUser(u)}
                        className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-purple-500/30 text-purple-200 hover:bg-purple-500 hover:text-white transition-all disabled:opacity-60"
                      >
                        แบน
                      </button>

                      {isBanned && (
                        <button
                          disabled={isBusy}
                          onClick={() => unbanUser(u)}
                          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-200 hover:bg-white/5 transition-all disabled:opacity-60"
                        >
                          ปลดแบน
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

