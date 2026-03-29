"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminAnnouncementsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const approvalStatusLabel = (value) => {
    switch (value) {
      case "pending":
        return "รออนุมัติ";
      case "approved":
        return "อนุมัติแล้ว";
      case "rejected":
        return "ไม่อนุมัติ";
      case "removed":
        return "ถอดประกาศ";
      default:
        return value ? String(value) : "-";
    }
  };

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/items");
      const data = await res.json();
      const allItems = Array.isArray(data) ? data : [];
      setItems(
        allItems.filter(
          (item) => String(item?.status || "").toLowerCase() !== "exchanged"
        )
      );
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

  const act = async (id, action) => {
    setUpdatingId(id);
    try {
      await fetch(`/api/admin/items/${id}/${action}`, { method: "POST" });
      await load();
    } finally {
      setUpdatingId(null);
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
                จัดการประกาศแลกของ
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                ตรวจสอบ/อนุมัติประกาศใหม่ และถอดประกาศที่มีปัญหาหรือถูกร้องเรียนเยอะ
              </p>
            </div>
          </div>

        {loading ? (
          <div className="text-slate-500 italic">กำลังดึงข้อมูล...</div>
        ) : items.length === 0 ? (
          <div className="text-slate-500 italic glass-card p-8 rounded-[30px] border border-white/5 bg-slate-900/30">
            ยังไม่มีรายการประกาศ
          </div>
        ) : (
          <div className="grid gap-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="glass-card p-5 rounded-[30px] border border-white/5 bg-slate-900/50 flex flex-col md:flex-row gap-4"
              >
                <div className="flex gap-4 w-full md:w-1/2">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-slate-800">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-widest text-amber-400 font-black">
                      {item.category || "ไม่ระบุหมวดหมู่"}
                    </p>
                    <p className="font-bold text-lg text-white line-clamp-1">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                      {item.description}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      เจ้าของ:{" "}
                      {item.owner_id ? (
                        <Link
                          href={`/users/${item.owner_id}`}
                          className="hover:underline underline-offset-2"
                        >
                          {item.owner_name || item.owner_email}
                        </Link>
                      ) : (
                        item.owner_name || item.owner_email
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      สร้างเมื่อ:{" "}
                      {new Date(item.created_at).toLocaleString("th-TH")}
                    </p>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                        item.approval_status === "pending"
                          ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                          : item.approval_status === "approved"
                          ? "bg-green-500/10 text-green-400 border-green-500/30"
                          : item.approval_status === "rejected"
                          ? "bg-red-500/10 text-red-400 border-red-500/30"
                          : "bg-slate-500/10 text-slate-300 border-white/20"
                      }`}
                    >
                      {approvalStatusLabel(item.approval_status)}
                    </span>

                    <span className="text-[11px] text-red-300 border border-red-500/30 bg-red-500/10 px-2 py-1 rounded-full">
                      ร้องเรียน: {item.complaint_count ?? 0} ครั้ง
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {item.approval_status === "pending" && (
                      <>
                        <button
                          disabled={updatingId === item.id}
                          onClick={() => act(item.id, "approve")}
                          className="px-4 py-2 rounded-xl text-xs font-bold border border-green-500/40 text-green-300 hover:bg-green-500 hover:text-slate-950 transition-all"
                        >
                          ✅ อนุมัติ
                        </button>
                        <button
                          disabled={updatingId === item.id}
                          onClick={() => act(item.id, "reject")}
                          className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/40 text-red-300 hover:bg-red-500 hover:text-white transition-all"
                        >
                          ❌ ไม่อนุมัติ
                        </button>
                      </>
                    )}

                    {item.approval_status === "approved" && (
                      <button
                        disabled={updatingId === item.id}
                        onClick={() => {
                          if (
                            confirm(
                              "ถอดประกาศนี้ออกจากหน้าเว็บ? (ยังเก็บประวัติไว้ในระบบ)"
                            )
                          ) {
                            act(item.id, "remove");
                          }
                        }}
                        className="px-4 py-2 rounded-xl text-xs font-bold border border-red-500/40 text-red-300 hover:bg-red-600 hover:text-white transition-all"
                      >
                        🗑️ ถอดประกาศ
                      </button>
                    )}
                  </div>
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

