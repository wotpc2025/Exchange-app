"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getSeverity(report) {
  const text = `${report?.reason || ""} ${report?.evidence_text || ""}`.toLowerCase();
  if (/(โกง|หลอก|scam|fraud|ปลอม|ข่มขู่|คุกคาม|ทำร้าย|แบล็คเมล|blackmail|violence)/i.test(text)) {
    return "high";
  }
  if (/(สแปม|spam|หยาบคาย|ไม่สุภาพ|นัดแล้วไม่มา|ผิดนัด|ไม่ตรงปก|หลบเลี่ยง)/i.test(text)) {
    return "medium";
  }
  return "low";
}

function severityLabel(sev) {
  if (sev === "high") return "สูง";
  if (sev === "medium") return "กลาง";
  return "ต่ำ";
}

function severityClass(sev) {
  if (sev === "high") return "bg-red-500/10 text-red-300 border-red-500/30";
  if (sev === "medium") return "bg-amber-500/10 text-amber-300 border-amber-500/30";
  return "bg-slate-500/10 text-slate-300 border-white/10";
}

function statusClass(status) {
  if (status === "open") return "bg-red-500/10 text-red-300 border-red-500/30";
  if (status === "reviewed") return "bg-blue-500/10 text-blue-300 border-blue-500/30";
  return "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
}

export default function AdminReportsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [busyId, setBusyId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/reports");
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
    return rows.filter((r) => {
      const sev = getSeverity(r);
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (severityFilter !== "all" && sev !== severityFilter) return false;

      if (!term) return true;
      const pool = [
        r.reason,
        r.evidence_text,
        r.status,
        r.reporter_email,
        r.reporter_name,
        r.reported_email,
        r.reported_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return pool.includes(term);
    });
  }, [rows, q, statusFilter, severityFilter]);

  const updateStatus = async (reportId, nextStatus) => {
    setBusyId(reportId);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "อัปเดตสถานะไม่สำเร็จ");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const issueWarning = async (report, type) => {
    const defaultReason = report?.reason ? String(report.reason).slice(0, 300) : "รายงานพฤติกรรมไม่เหมาะสม";
    const reason = prompt(`เหตุผล${type === "yellow" ? "ใบเหลือง" : "ใบแดง"}:`, defaultReason);
    if (reason === null) return;

    setBusyId(report.id);
    try {
      const res = await fetch(`/api/admin/users/${report.reported_user_id}/warn/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, reportId: report.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ให้ใบเตือนไม่สำเร็จ");
        return;
      }

      await fetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });

      await load();
      alert(type === "yellow" ? "ออกใบเหลืองเรียบร้อย" : "ออกใบแดงเรียบร้อย");
    } finally {
      setBusyId(null);
    }
  };

  const banUser = async (report) => {
    if ((Number(report?.reported_red_count) || 0) < 1) {
      alert("ผู้ใช้นี้ยังไม่มีใบแดง จึงยังแบนไม่ได้");
      return;
    }

    const type = prompt("พิมพ์ประเภทแบน: temporary หรือ permanent", "temporary");
    if (type !== "temporary" && type !== "permanent") return;

    let amount;
    let unit;
    if (type === "temporary") {
      amount = prompt("จำนวน (ตัวเลข):", "7");
      unit = prompt("หน่วย: day หรือ month หรือ year", "day");
      if (!amount || !unit) return;
    }

    const reason = prompt("เหตุผลแบน (ไม่ใส่ก็ได้):", report?.reason || "") || "";

    setBusyId(report.id);
    try {
      const res = await fetch(`/api/admin/users/${report.reported_user_id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ban_type: type,
          amount,
          unit,
          reason,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "แบนไม่สำเร็จ");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const banPreset = async (report, preset) => {
    const reason = prompt("เหตุผลแบน (ไม่ใส่ก็ได้):", report?.reason || "") || "";
    const payload =
      preset === "permanent"
        ? { ban_type: "permanent", reason }
        : {
            ban_type: "temporary",
            amount: preset === "7d" ? 7 : 30,
            unit: "day",
            reason,
          };

    setBusyId(report.id);
    try {
      const res = await fetch(`/api/admin/users/${report.reported_user_id}/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "แบนไม่สำเร็จ");
        return;
      }
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const unbanUser = async (report) => {
    if (!confirm("ยืนยันปลดแบนผู้ใช้รายนี้?")) return;
    setBusyId(report.id);
    try {
      const res = await fetch(`/api/admin/users/${report.reported_user_id}/unban`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ปลดแบนไม่สำเร็จ");
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
                รายงานผู้ใช้
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                ตรวจสอบรายงานและดำเนินการให้ใบเหลือง/ใบแดงจากเคสเดียวกัน
              </p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-3xl border border-white/5 bg-slate-900/40 mb-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาอีเมล/ชื่อ/เหตุผล/หลักฐาน..."
              className="md:col-span-2 bg-slate-900/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500/50 transition-all text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500/50 transition-all text-white"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="open">open</option>
              <option value="reviewed">reviewed</option>
              <option value="closed">closed</option>
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-900/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500/50 transition-all text-white"
            >
              <option value="all">ทุกระดับความรุนแรง</option>
              <option value="high">สูง</option>
              <option value="medium">กลาง</option>
              <option value="low">ต่ำ</option>
            </select>
          </div>

          {loading ? (
            <div className="text-slate-500 italic">กำลังดึงข้อมูล...</div>
          ) : filtered.length === 0 ? (
            <div className="text-slate-500 italic glass-card p-8 rounded-[30px] border border-white/5 bg-slate-900/30">
              ไม่พบรายงานผู้ใช้
            </div>
          ) : (
            <div className="space-y-4">
              {filtered.map((r) => {
                const isBusy = busyId === r.id;
                const severity = getSeverity(r);
                return (
                  <div
                    key={r.id}
                    className="glass-card p-5 rounded-[30px] border border-white/5 bg-slate-900/50"
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${statusClass(r.status)}`}>
                            {r.status || "open"}
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${severityClass(severity)}`}>
                            ความรุนแรง: {severityLabel(severity)}
                          </span>
                          <span className="text-xs text-slate-500">#{r.id}</span>
                        </div>

                        <p className="text-xs text-slate-400 mt-2">
                          ผู้รายงาน:{" "}
                          {r.reporter_id ? (
                            <Link href={`/users/${r.reporter_id}`} className="hover:underline underline-offset-2">
                              {r.reporter_name || r.reporter_email}
                            </Link>
                          ) : (
                            r.reporter_name || r.reporter_email
                          )}
                          {"  "}·{"  "}
                          ผู้ถูกรายงาน:{" "}
                          <Link href={`/users/${r.reported_user_id}`} className="hover:underline underline-offset-2">
                            {r.reported_name || r.reported_email || `user #${r.reported_user_id}`}
                          </Link>
                        </p>

                        {r.reason ? (
                          <p className="text-sm text-slate-200 mt-3 whitespace-pre-wrap">
                            เหตุผล: {r.reason}
                          </p>
                        ) : null}

                        {r.evidence_text ? (
                          <p className="text-sm text-slate-300 mt-2 whitespace-pre-wrap">
                            หลักฐาน: {r.evidence_text}
                          </p>
                        ) : null}

                        {r.evidence_image_url ? (
                          <a
                            href={r.evidence_image_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-block mt-2 text-xs text-amber-300 hover:underline underline-offset-2 break-all"
                          >
                            เปิดรูปหลักฐาน
                          </a>
                        ) : null}

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                            Yellow: {r.reported_yellow_count || 0}
                          </span>
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest bg-red-500/10 text-red-300 border-red-500/30">
                            Red: {r.reported_red_count || 0}
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${r.reported_active_ban_type ? "bg-purple-500/10 text-purple-300 border-purple-500/30" : "bg-green-500/10 text-green-300 border-green-500/30"}`}>
                            {r.reported_active_ban_type
                              ? r.reported_active_ban_type === "permanent"
                                ? "แบนถาวร"
                                : `แบนถึง ${r.reported_active_ban_end_at ? new Date(r.reported_active_ban_end_at).toLocaleString("th-TH") : "-"}`
                              : "ไม่แบน"}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <p className="text-[10px] text-slate-500 uppercase">
                          {r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : ""}
                        </p>

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            disabled={isBusy}
                            onClick={() => updateStatus(r.id, "reviewed")}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-blue-500/30 text-blue-200 hover:bg-blue-500 hover:text-white transition-all disabled:opacity-60"
                          >
                            ทำเครื่องหมาย reviewed
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => updateStatus(r.id, "closed")}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-emerald-500/30 text-emerald-200 hover:bg-emerald-500 hover:text-slate-950 transition-all disabled:opacity-60"
                          >
                            ปิดเคส
                          </button>
                        </div>

                        <div className="flex flex-wrap justify-end gap-2">
                          <button
                            disabled={isBusy}
                            onClick={() => issueWarning(r, "yellow")}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500 hover:text-slate-950 transition-all disabled:opacity-60"
                          >
                            ออกใบเหลือง
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => issueWarning(r, "red")}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-red-500/30 text-red-300 hover:bg-red-500 hover:text-white transition-all disabled:opacity-60"
                          >
                            ออกใบแดง
                          </button>
                          <button
                            disabled={isBusy}
                            onClick={() => banUser(r)}
                            className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-purple-500/30 text-purple-200 hover:bg-purple-500 hover:text-white transition-all disabled:opacity-60"
                          >
                            แบน
                          </button>
                          {r.reported_active_ban_type ? (
                            <button
                              disabled={isBusy}
                              onClick={() => unbanUser(r)}
                              className="px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-200 hover:bg-white/5 transition-all disabled:opacity-60"
                            >
                              ปลดแบน
                            </button>
                          ) : null}
                        </div>

                        {!r.reported_active_ban_type ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              disabled={isBusy || (Number(r?.reported_red_count) || 0) < 1}
                              onClick={() => banPreset(r, "7d")}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-purple-500/30 text-purple-200 hover:bg-purple-500 hover:text-white transition-all disabled:opacity-60"
                            >
                              แบน 7 วัน
                            </button>
                            <button
                              disabled={isBusy || (Number(r?.reported_red_count) || 0) < 1}
                              onClick={() => banPreset(r, "30d")}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-purple-500/30 text-purple-200 hover:bg-purple-500 hover:text-white transition-all disabled:opacity-60"
                            >
                              แบน 30 วัน
                            </button>
                            <button
                              disabled={isBusy || (Number(r?.reported_red_count) || 0) < 1}
                              onClick={() => banPreset(r, "permanent")}
                              className="px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-fuchsia-500/30 text-fuchsia-200 hover:bg-fuchsia-500 hover:text-white transition-all disabled:opacity-60"
                            >
                              แบนถาวร
                            </button>
                          </div>
                        ) : null}
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
