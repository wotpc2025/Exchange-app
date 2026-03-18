"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function SupportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const loadConversations = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/support/conversations");
      const data = await res.json();
      setConversations(Array.isArray(data) ? data : []);
      return Array.isArray(data) ? data : [];
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
    loadConversations();
  }, [session, status]);

  const sendNewMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/support/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_text: input }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error || "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      const data = await res.json().catch(() => ({}));
      setInput("");
      const newId = data?.conversation_id;
      if (newId != null) {
        router.push(`/support/${newId}`);
        return;
      }

      // Fallback: ถ้า API ไม่ส่ง id กลับมา ให้ดึงห้องล่าสุดแล้วพาไป
      const latest = await loadConversations();
      const latestId = latest?.[0]?.id;
      if (latestId != null) router.push(`/support/${latestId}`);
    } finally {
      setSending(false);
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
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            ← กลับหน้าหลัก
          </Link>
        </div>
      </nav>
    <div className="p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="min-w-0">
              <h1 className="text-3xl font-black text-amber-500">
                ศูนย์ช่วยเหลือและสนับสนุน
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                หากคุณมีคำถามหรือปัญหาใด ๆ เกี่ยวกับการใช้งาน BUU Exchange โปรดอย่าลังเลที่จะติดต่อเรา ทีมงานของเราพร้อมให้ความช่วยเหลือคุณเสมอ
              </p>
            </div>
          </div>

        <div className="glass-card p-6 rounded-[30px] border border-white/5 bg-slate-900/40 mb-6">
          <form onSubmit={sendNewMessage} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] uppercase tracking-widest font-black px-3 py-1.5 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/20">
                NEW ROOM
              </span>
            </div>
            {error ? (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-3">
                {error}
              </div>
            ) : null}
            <div className="grid gap-2">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">
                หัวข้อคำถาม / ปัญหา
              </label>
              <input
                className="w-full bg-slate-800/60 rounded-2xl px-4 py-4 outline-none border border-white/5 focus:border-amber-500/50 transition-all text-sm"
                placeholder="รายงานปัญหาการใช้งาน / ขอความช่วยเหลือ..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                maxLength={200}
              />
              <p className="text-[11px] text-slate-500">
                หลังจากเปิดห้องแล้ว คุณสามารถพิมพ์รายละเอียดเพิ่มเติมในห้องแชทได้
              </p>
            </div>
            <button
              disabled={sending}
              className="gold-glow bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 font-black py-3 px-6 rounded-2xl transition-all uppercase tracking-wider text-sm"
            >
              {sending ? "กำลังเปิดห้อง..." : "เปิดห้องแชท (เริ่มเคส)"}
            </button>
          </form>
        </div>

        <h2 className="font-black uppercase tracking-widest text-xs text-slate-500 mb-3">
          ประวัติห้องแชท (Rooms)
        </h2>

        {loading ? (
          <div className="text-slate-500 italic">กำลังดึงข้อมูล...</div>
        ) : conversations.length === 0 ? (
          <div className="text-slate-500 italic glass-card p-8 rounded-[30px] border border-white/5 bg-slate-900/30">
            ยังไม่มีห้องสนทนา
          </div>
        ) : (
          <div className="grid gap-4">
            {conversations.map((c, i) => (
              <Link
                key={`conv-${i}-${c?.id ?? "noid"}-${c?.created_at ?? ""}`}
                href={`/support/${c.id}`}
              >
                <div className="glass-card p-5 rounded-[30px] border border-white/5 hover:border-amber-500/50 transition-all bg-slate-900/40">
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
                          {c.status === "open" ? "OPEN" : "CLOSED"}
                        </span>
                        <span className="text-xs text-slate-500">#{c.id}</span>
                        <span className="text-[10px] text-slate-500 truncate">
                          {c.admin_name ? `แอดมิน: ${c.admin_name}` : "รอแอดมินรับเรื่อง"}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-100 font-semibold line-clamp-1">
                        {c.subject || "—"}
                      </p>
                      <p className="mt-1 text-xs text-slate-400 line-clamp-2">
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
                        ดูแชท →
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

