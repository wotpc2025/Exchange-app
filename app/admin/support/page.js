"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NotificationBell from "@/components/NotificationBell";

export default function AdminSupportListPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [conversations, setConversations] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/support/conversations");
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
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
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [session, status]);

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
              <h1 className="text-3xl font-black text-amber-500">
                กล่องข้อความ (Admin)
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                เลือกห้องเพื่อเข้าไปตอบ เมื่อเคสจบ นักศึกษาจะเป็นคนกดจบเคสเอง
              </p>
            </div>
          </div>
        {loading ? (
          <div className="text-slate-500 italic">กำลังดึงข้อมูล...</div>
        ) : conversations.length === 0 ? (
          <div className="text-slate-500 italic glass-card p-8 rounded-[30px] border border-white/5 bg-slate-900/30">
            ยังไม่มีข้อความจากนักศึกษา
          </div>
        ) : (
          <div className="grid gap-4">
            {conversations.map((c, i) => (
              <div
                key={`conv-${i}-${c?.id ?? "noid"}-${c?.created_at ?? ""}`}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/admin/support/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/admin/support/${c.id}`);
                  }
                }}
                className="glass-card p-5 rounded-[30px] border border-white/5 hover:border-amber-500/50 transition-all bg-slate-900/40 cursor-pointer"
              >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest ${
                            c.status === "open"
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-slate-500/10 text-slate-300 border-white/10"
                          }`}
                        >
                          {c.status === "open" ? "เปิดเคส" : "ปิดเคสแล้ว"}
                        </span>
                        <span className="text-xs text-slate-500">#{c.id}</span>
                        <span className="text-xs text-slate-300 truncate">
                          {c.student_id ? (
                            <Link
                              href={`/users/${c.student_id}`}
                              className="hover:underline underline-offset-2"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {c.student_name || c.student_email}
                            </Link>
                          ) : (
                            c.student_name || c.student_email
                          )}
                        </span>
                        {c.admin_email && (
                          <span className="text-[10px] text-blue-300 border border-blue-500/30 bg-blue-500/10 px-2 py-1 rounded-full">
                            admin:{" "}
                            {c.admin_id ? (
                              <Link
                                href={`/users/${c.admin_id}`}
                                className="hover:underline underline-offset-2"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {c.admin_name || c.admin_email}
                              </Link>
                            ) : (
                              c.admin_name || c.admin_email
                            )}
                          </span>
                        )}
                      </div>

                      <p className="mt-2 text-sm text-slate-200 line-clamp-2">
                        {c.last_message || "—"}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-slate-500 uppercase">
                        {c.last_message_at
                          ? new Date(c.last_message_at).toLocaleString()
                          : new Date(c.created_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-amber-400 font-bold mt-1">
                        เปิดห้อง →
                      </p>
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

