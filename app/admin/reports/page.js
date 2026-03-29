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
  if (sev === "high") return "bg-red-500/10 text-red-300 border-red-500/35";
  if (sev === "medium") return "bg-orange-500/10 text-orange-300 border-orange-500/35";
  return "bg-slate-500/10 text-slate-300 border-slate-500/35";
}

function normalizeReportStatus(s) {
  return String(s ?? "open").trim().toLowerCase();
}

/** แสดงในป้าย — ค่าใน DB ยังเป็น open / reviewed / closed */
function reportStatusLabel(s) {
  const v = normalizeReportStatus(s);
  if (v === "open") return "เปิดเคส";
  if (v === "reviewed") return "กำลังตรวจสอบ";
  if (v === "closed") return "ปิดเคส";
  return s ? String(s) : "เปิดเคส";
}

function statusClass(status) {
  const v = normalizeReportStatus(status);
  if (v === "open") return "bg-green-500/10 text-green-300 border-green-500/35";
  if (v === "reviewed") return "bg-blue-500/10 text-blue-300 border-blue-500/35";
  if (v === "closed") return "bg-slate-600/15 text-slate-200 border-slate-500/40";
  return "bg-slate-600/15 text-slate-200 border-slate-500/40";
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
  /** Modal ลงโทษ */
  const [punishModal, setPunishModal] = useState(null);
  const [punishKind, setPunishKind] = useState("yellow");
  const [punishNote, setPunishNote] = useState("");

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

  useEffect(() => {
    if (!punishModal) return;
    const onKey = (e) => {
      if (e.key === "Escape") setPunishModal(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [punishModal]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      const sev = getSeverity(r);
      if (statusFilter !== "all" && normalizeReportStatus(r.status) !== statusFilter) return false;
      if (severityFilter !== "all" && sev !== severityFilter) return false;

      if (!term) return true;
      const pool = [
        r.reason,
        r.evidence_text,
        r.status,
        reportStatusLabel(r.status),
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

  const defaultWarnReason = (report) =>
    report?.reason ? String(report.reason).slice(0, 300) : "รายงานพฤติกรรมไม่เหมาะสม";

  /** @returns {Promise<boolean>} */
  const issueWarning = async (report, type, reasonText) => {
    const reason =
      reasonText != null && String(reasonText).trim() !== ""
        ? String(reasonText).trim().slice(0, 400)
        : defaultWarnReason(report);

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
        return false;
      }

      await fetch(`/api/admin/reports/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "reviewed" }),
      });

      await load();
      alert(
        "ออกใบเหลืองเรียบร้อย — ครบ 2 ใบเหลืองระบบจะออกใบแดงอัตโนมัติ"
      );
      return true;
    } finally {
      setBusyId(null);
    }
  };

  /** @returns {Promise<boolean>} */
  const banPreset = async (report, preset, reasonText) => {
    const fallback = report?.reason ? String(report.reason).slice(0, 400) : "";
    const reason =
      reasonText != null && String(reasonText).trim() !== ""
        ? String(reasonText).trim().slice(0, 400)
        : fallback;

    let amount = 7;
    if (preset === "7d") amount = 7;
    else if (preset === "15d") amount = 15;

    const payload =
      preset === "permanent"
        ? { ban_type: "permanent", reason }
        : {
            ban_type: "temporary",
            amount,
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
        return false;
      }
      await load();
      return true;
    } finally {
      setBusyId(null);
    }
  };

  const openPunishModal = (report) => {
    setPunishModal(report);
    setPunishKind("yellow");
    setPunishNote("");
  };

  const submitPunishModal = async () => {
    if (!punishModal) return;
    const report = punishModal;
    const note = punishNote.trim();
    const redOk = (Number(report?.reported_red_count) || 0) >= 1;

    let ok = false;
    if (["ban_7d", "ban_15d", "ban_perm"].includes(punishKind)) {
      if (!redOk) {
        alert("ผู้ใช้นี้ยังไม่มีใบแดง จึงยังแบนไม่ได้");
        return;
      }
    }

    switch (punishKind) {
      case "yellow":
        ok = await issueWarning(report, "yellow", note || undefined);
        break;
      case "ban_7d":
        ok = await banPreset(report, "7d", note);
        break;
      case "ban_15d":
        ok = await banPreset(report, "15d", note);
        break;
      case "ban_perm":
        ok = await banPreset(report, "permanent", note);
        break;
      default:
        return;
    }

    if (ok) {
      setPunishModal(null);
      setPunishNote("");
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
              <option value="open">เปิดเคส</option>
              <option value="reviewed">กำลังตรวจสอบ</option>
              <option value="closed">ปิดเคส</option>
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
                const st = normalizeReportStatus(r.status);
                const caseClosed = st === "closed";
                return (
                  <div
                    key={r.id}
                    className={`glass-card p-5 rounded-[30px] border border-white/5 bg-slate-900/50 ${caseClosed ? "opacity-75" : ""}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border tracking-wide ${statusClass(r.status)}`}>
                            {reportStatusLabel(r.status)}
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border tracking-wide ${severityClass(severity)}`}>
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
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-full border tracking-wide bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                            ใบเหลือง: {r.reported_yellow_count || 0}
                          </span>
                          <span className="text-[10px] font-black px-3 py-1.5 rounded-full border tracking-wide bg-red-500/10 text-red-300 border-red-500/30">
                            ใบแดง: {r.reported_red_count || 0}
                          </span>
                          <span className={`text-[10px] font-black px-3 py-1.5 rounded-full border tracking-wide ${r.reported_active_ban_type ? "bg-red-950/50 text-red-200 border-red-900/55" : "bg-green-500/10 text-green-300 border-green-500/35"}`}>
                            {r.reported_active_ban_type
                              ? r.reported_active_ban_type === "permanent"
                                ? "แบนถาวร"
                                : `แบนถึง ${r.reported_active_ban_end_at ? new Date(r.reported_active_ban_end_at).toLocaleString("th-TH") : "-"}`
                              : "ไม่แบน"}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0 flex flex-col items-end gap-2">
                        <p className="text-[10px] text-slate-500">
                          {r.created_at ? new Date(r.created_at).toLocaleString("th-TH") : ""}
                        </p>

                        <div className="flex flex-col items-end gap-2 w-full max-w-xs">
                          <label className="text-[10px] text-slate-500 self-end">
                            สถานะเคส
                          </label>
                          <select
                            disabled={caseClosed || isBusy}
                            value={caseClosed ? "closed" : st === "open" ? "" : st}
                            onChange={(e) => {
                              const v = e.target.value;
                              if (!v) return;
                              updateStatus(r.id, v);
                            }}
                            className="w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 px-3 text-xs text-white outline-none focus:border-blue-500/50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {st === "open" ? (
                              <option value="">เลือก: กำลังตรวจสอบ หรือ ปิดเคส</option>
                            ) : null}
                            {!caseClosed ? (
                              <>
                                <option value="reviewed">กำลังตรวจสอบ</option>
                                <option value="closed">ปิดเคส</option>
                              </>
                            ) : (
                              <option value="closed">ปิดเคสแล้ว — แก้ไขไม่ได้</option>
                            )}
                          </select>
                        </div>

                        {!caseClosed ? (
                          <div className="flex flex-wrap justify-end gap-2">
                            {!r.reported_active_ban_type ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openPunishModal(r)}
                                className="px-4 py-2 rounded-xl text-xs font-black tracking-wide border border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500 hover:text-slate-950 transition-all disabled:opacity-60"
                              >
                                ดำเนินการลงโทษ
                              </button>
                            ) : null}
                            {r.reported_active_ban_type ? (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => unbanUser(r)}
                                className="px-4 py-2 rounded-xl text-xs font-black tracking-wide border border-slate-500/40 text-slate-200 hover:bg-white/10 transition-all disabled:opacity-60"
                              >
                                ปลดแบน
                              </button>
                            ) : null}
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

      {punishModal ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="punish-modal-title"
          onClick={() => setPunishModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl shadow-black/50"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="punish-modal-title" className="text-lg font-black text-amber-400">
              ดำเนินการลงโทษ
            </h2>
            <p className="text-xs text-slate-400 mt-3">
              ผู้ถูกรายงาน:{" "}
              <span className="text-slate-200">
                {punishModal.reported_name || punishModal.reported_email || `user #${punishModal.reported_user_id}`}
              </span>
            </p>

            <label className="block text-xs font-bold text-slate-400 mt-4">ประเภทการลงโทษ</label>
            <select
              value={punishKind}
              onChange={(e) => setPunishKind(e.target.value)}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/80 py-2.5 px-3 text-sm text-white outline-none focus:border-amber-500/50"
            >
              <option value="yellow">ออกใบเหลือง</option>
              <option value="ban_7d">แบน 7 วัน</option>
              <option value="ban_15d">แบน 15 วัน</option>
              <option value="ban_perm">แบนถาวร</option>
            </select>
            <p className="text-[10px] text-slate-500 mt-2">
              ออกได้เฉพาะใบเหลือง — เมื่อครบ 2 ใบเหลือง ระบบจะออกใบแดงให้อัตโนมัติ
              <br />
              แบนชั่วคราวจะปลดอัตโนมัติเมื่อครบกำหนด (ตรวจตอนเข้าสู่ระบบ) — ปลดก่อนกำหนดได้ที่จัดการผู้ใช้
            </p>

            <label className="block text-xs font-bold text-slate-400 mt-4">หมายเหตุ</label>
            <textarea
              value={punishNote}
              onChange={(e) => setPunishNote(e.target.value)}
              rows={3}
              placeholder="ระบุเหตุผลหรือหมายเหตุ (ไม่บังคับ)"
              className="mt-1 w-full resize-y rounded-xl border border-white/10 bg-slate-950/80 py-2 px-3 text-sm text-white placeholder:text-slate-600 outline-none focus:border-amber-500/50"
            />

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setPunishModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-white/10 text-slate-300 hover:bg-white/5"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={busyId === punishModal.id}
                onClick={() => submitPunishModal()}
                className="px-4 py-2 rounded-xl text-xs font-black border border-amber-500/50 bg-amber-500/20 text-amber-100 hover:bg-amber-500 hover:text-slate-950 transition-all disabled:opacity-50"
              >
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
