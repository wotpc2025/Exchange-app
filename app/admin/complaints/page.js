"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function AdminComplaintsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const complaintStatusLabel = (value) => {
    switch (value) {
      case "open":
        return "เปิดเคส";
      case "closed":
        return "ปิดเคสแล้ว";
      default:
        return value ? String(value) : "-";
    }
  };

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/complaints");
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
    return rows.filter((c) => {
      const parts = [
        c.item_title,
        c.student_email,
        c.student_name,
        c.owner_email,
        c.reason,
        c.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return parts.includes(term);
    });
  }, [rows, q]);

  const closeCase = async (c) => {
    if (c.status === "closed") return;
    const adminNote = prompt("บันทึกหมายเหตุปิดเคส (ไม่ใส่ก็ได้):") || "";
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/admin/complaints/${c.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminNote }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ปิดเคสไม่สำเร็จ");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
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
                รายการร้องเรียนประกาศ
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                ตรวจสอบหลักฐาน และปิดเคสเมื่อดำเนินการเรียบร้อย
              </p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-white/5 bg-slate-900/40 mb-6 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาชื่อ/อีเมล/หัวข้อประกาศ/สถานะ..."
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
              ไม่พบรายการร้องเรียน
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((c) => {
                const isBusy = busyId === c.id;
                const isClosed = c.status === "closed";
                return (
                  <div
                    key={c.id}
                    className="glass-card p-5 rounded-[30px] border border-white/5 bg-slate-900/50"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                              isClosed
                                ? "bg-slate-500/10 text-slate-300 border-white/10"
                                : "bg-red-500/10 text-red-300 border-red-500/30"
                            }`}
                          >
                            {complaintStatusLabel(c.status)}
                          </span>
                          <span className="text-xs text-slate-500">#{c.id}</span>
                          <Link
                            href={`/items/${c.item_id}`}
                            className="text-sm text-slate-200 hover:underline underline-offset-2 truncate"
                          >
                            {c.item_title || `item #${c.item_id}`}
                          </Link>
                        </div>

                        <p className="text-xs text-slate-400 mt-2">
                          ผู้ร้องเรียน:{" "}
                          {c.student_id ? (
                            <Link
                              href={`/users/${c.student_id}`}
                              className="hover:underline underline-offset-2"
                            >
                              {c.student_name || c.student_email}
                            </Link>
                          ) : (
                            c.student_name || c.student_email
                          )}
                          {"  "}·{"  "}เจ้าของประกาศ:{" "}
                          {c.owner_id ? (
                            <Link
                              href={`/users/${c.owner_id}`}
                              className="hover:underline underline-offset-2"
                            >
                              {c.owner_email}
                            </Link>
                          ) : (
                            c.owner_email
                          )}
                        </p>

                        {c.reason ? (
                          <p className="text-sm text-slate-200 mt-3">
                            เหตุผล: {c.reason}
                          </p>
                        ) : null}

                        {c.evidence_text ? (
                          <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">
                            หลักฐาน: {c.evidence_text}
                          </p>
                        ) : null}

                        {c.evidence_image_url ? (
                          <a
                            href={c.evidence_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-2 text-xs text-amber-300 hover:underline underline-offset-2 break-all"
                          >
                            เปิดรูปหลักฐาน
                          </a>
                        ) : null}

                        {c.admin_note ? (
                          <p className="text-xs text-slate-400 mt-3">
                            หมายเหตุแอดมิน: {c.admin_note}
                          </p>
                        ) : null}
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <p className="text-[10px] text-slate-500 uppercase">
                          {c.created_at
                            ? new Date(c.created_at).toLocaleString()
                            : ""}
                        </p>
                        <button
                          disabled={isClosed || isBusy}
                          onClick={() => closeCase(c)}
                          className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500 hover:text-slate-950 transition-all disabled:opacity-60"
                        >
                          {isClosed ? "ปิดแล้ว" : isBusy ? "กำลังปิด..." : "ปิดเคส"}
                        </button>
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

