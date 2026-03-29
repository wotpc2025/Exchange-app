"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function AdminSupportRoomPage({ params }) {
  const pathname = usePathname();
  const id = pathname?.split("/").filter(Boolean).pop();

  const { data: session, status } = useSession();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/support/conversations/${id}`);
      const data = await res.json();
      if (res.ok) {
        setConversation(data.conversation);
        setMessages(data.messages || []);
      }
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
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [session, status, id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    const text = input;
    setInput("");

    await fetch(`/api/support/conversations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_text: text }),
    });

    await fetchData();
  };


  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        กำลังเปิดห้องสนทนา...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-white">
      <div className="p-4 border-b border-white/10 glass-card flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin/support"
            className="mr-2 text-slate-400 hover:text-white"
          >
            ←
          </Link>
          <div className="min-w-0">
            <h2 className="font-bold text-sm md:text-base line-clamp-1">
              Support #{id} ·{" "}
              {conversation?.student_id ? (
                <Link
                  href={`/users/${conversation.student_id}`}
                  className="hover:underline underline-offset-2"
                >
                  {conversation.student_name || conversation.student_email}
                </Link>
              ) : (
                conversation?.student_name || conversation?.student_email
              )}
            </h2>
            <p className="text-[10px] font-bold tracking-wide text-slate-400">
              สถานะ:{" "}
              {conversation?.status === "open"
                ? "เปิดเคส"
                : conversation?.status === "closed"
                  ? "ปิดเคสแล้ว"
                  : conversation?.status || "—"}{" "}
              {conversation?.admin_email && (
                <>
                  · แอดมิน:{" "}
                  {conversation.admin_id ? (
                    <Link
                      href={`/users/${conversation.admin_id}`}
                      className="hover:underline underline-offset-2"
                    >
                      {conversation.admin_name || conversation.admin_email}
                    </Link>
                  ) : (
                    conversation.admin_name || conversation.admin_email
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="text-[10px] font-black px-4 py-2 rounded-xl tracking-wide border border-white/10 text-slate-400 bg-slate-950/30">
          {conversation?.status === "open"
            ? "รอให้นักศึกษาจบเคส"
            : "เคสถูกปิดแล้ว"}
        </div>
      </div>

      <div className="chat-thread-bg flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length > 0 ? (
          messages.map((msg, i) => {
            const key = `msg-${i}-${msg?.id ?? "noid"}-${msg?.created_at ?? ""}`;
            return (
            <div
              key={key}
              className={`flex flex-col ${
                msg.sender_role === "admin" ? "items-end" : "items-start"
              }`}
            >
              <div
                className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-lg ${
                  msg.sender_role === "admin"
                    ? "bg-amber-500 text-slate-950 rounded-tr-none"
                    : "bg-slate-800 text-white rounded-tl-none"
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
              </div>
              <span className="text-[9px] text-slate-500 mt-1">
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            )
          })
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 italic text-sm text-center p-10">
            ยังไม่มีข้อความ
          </div>
        )}
      </div>

      <div className="p-4 bg-slate-900 border-t border-white/10">
        {conversation?.status === "open" ? (
          <form className="flex gap-2 max-w-4xl mx-auto" onSubmit={sendMessage}>
            <input
              className="flex-1 bg-slate-800 border-none rounded-2xl px-5 py-3 outline-none focus:ring-2 ring-amber-500/50 transition-all text-sm"
              placeholder="พิมพ์ข้อความตอบ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20">
              ส่ง
            </button>
          </form>
        ) : (
          <div className="text-center p-2 text-slate-500 text-sm italic">
            ห้องนี้ถูกปิดแล้ว (ดูประวัติย้อนหลังได้)
          </div>
        )}
      </div>
    </div>
  );
}

