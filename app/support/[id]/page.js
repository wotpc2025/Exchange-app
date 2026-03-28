"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function SupportRoomPage({ params }) {
  const [imagePreview, setImagePreview] = useState("");
  const getThaiSupportStatus = (rawStatus) => {
    const status = String(rawStatus || "").toLowerCase();
    if (status === "open") return "กำลังเปิดเคส";
    if (status === "closed") return "ปิดเคสแล้ว";
    return "ไม่ทราบสถานะ";
  };

  const pathname = usePathname();
  const id = pathname?.split("/").filter(Boolean).pop();

  const { data: session, status } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [closing, setClosing] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [likeAdmin, setLikeAdmin] = useState(true);
  const [closeError, setCloseError] = useState("");

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
    if (!session) {
      router.replace("/login");
      return;
    }
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [session, status, id]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() && !imagePreview) return;
    const text = input;
    const image = imagePreview;
    setInput("");
    setImagePreview("");
    await fetch(`/api/support/conversations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_text: text, image_data: image || null }),
    });
    await fetchData();
  };

  const onPickImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("รูปภาพใหญ่เกินไป (จำกัด 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        setImagePreview(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const closeCase = async () => {
    setClosing(true);
    setCloseError("");
    try {
      const res = await fetch(`/api/support/conversations/${id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ likeAdmin }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCloseError(data?.error || "ปิดเคสไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setShowCloseModal(false);
      await fetchData();
      alert("ปิดเคสเรียบร้อยแล้ว");
    } finally {
      setClosing(false);
    }
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
          <button
            onClick={() => router.back()}
            className="mr-2 text-slate-400 hover:text-white"
          >
            ←
          </button>
          <div className="min-w-0">
            <h2 className="font-bold text-sm md:text-base line-clamp-1">
              {conversation?.subject
                ? conversation.subject
                : `ห้องติดต่อแอดมิน #${id}`}
            </h2>
            <p className="text-[10px] text-slate-500 line-clamp-1">
              เคส #{id}
            </p>
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">
              สถานะ: {getThaiSupportStatus(conversation?.status)}
            </p>
            {!conversation?.admin_email && conversation?.status === "open" && (
              <p className="text-[10px] mt-1 text-slate-400">
                กำลังรอแอดมินรับเรื่อง...
              </p>
            )}
            {conversation?.admin_email && (
              <p className="text-[10px] mt-1 text-slate-400 truncate">
                Admin:{" "}
                {conversation.admin_id ? (
                  <Link
                    href={`/users/${conversation.admin_id}`}
                    className="font-medium hover:underline underline-offset-2"
                  >
                    {conversation.admin_name || conversation.admin_email}
                  </Link>
                ) : (
                  <span className="font-medium">
                    {conversation.admin_name || conversation.admin_email}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        <button
          disabled={
            closing ||
            conversation?.status !== "open" ||
            !conversation?.admin_email
          }
          onClick={() => {
            setLikeAdmin(true);
            setCloseError("");
            setShowCloseModal(true);
          }}
          className="text-[10px] font-black bg-amber-500/10 hover:bg-amber-500/20 disabled:opacity-60 text-amber-200 border border-amber-500/20 px-4 py-2 rounded-xl uppercase tracking-widest"
          title={
            !conversation?.admin_email
              ? "ต้องมีแอดมินรับเรื่องก่อนจึงจะปิดเคสได้"
              : "ปิดเคส"
          }
        >
          {closing ? "กำลังปิด..." : "จบเคส"}
        </button>
      </div>

      <div className="chat-thread-bg flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length > 0 ? (
          messages.map((msg, i) => {
            const key = `msg-${i}-${msg?.id ?? "noid"}-${msg?.created_at ?? ""}`;
            return (
              <div
                key={key}
                className={`flex flex-col ${
                  msg.sender_email === session?.user?.email
                    ? "items-end"
                    : "items-start"
                }`}
              >
                <div
                  className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-lg ${
                    msg.sender_email === session?.user?.email
                      ? "bg-amber-500 text-slate-950 rounded-tr-none"
                      : msg.sender_role === "admin"
                      ? "bg-blue-500/20 text-white border border-blue-500/30 rounded-tl-none"
                      : "bg-slate-800 text-white rounded-tl-none"
                  }`}
                >
                  {msg.image_url ? (
                    <a href={msg.image_url} target="_blank" rel="noreferrer">
                      <img src={msg.image_url} alt="chat-image" className="rounded-xl max-h-72 object-cover border border-white/20 mb-2" />
                    </a>
                  ) : null}
                  {msg.message_text ? (
                    <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                  ) : null}
                </div>
                <span className="text-[9px] text-slate-500 mt-1">
                  {new Date(msg.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            );
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
            {imagePreview && (
              <div className="mb-2 relative inline-block">
                <img src={imagePreview} alt="preview" className="h-24 rounded-xl border border-white/20 object-cover" />
                <button
                  type="button"
                  onClick={() => setImagePreview("")}
                  className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-red-500 text-white text-xs"
                >
                  ✕
                </button>
              </div>
            )}
            <label className="bg-slate-800 border-none rounded-2xl px-4 py-3 cursor-pointer hover:bg-slate-700 transition-all">
              📷
              <input type="file" accept="image/*" className="hidden" onChange={onPickImage} />
            </label>
            <input
              className="flex-1 bg-slate-800 border-none rounded-2xl px-5 py-3 outline-none focus:ring-2 ring-amber-500/50 transition-all text-sm"
              placeholder="พิมพ์ข้อความ..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20">
              ส่ง
            </button>
          </form>
        ) : (
          <div className="text-center p-2 text-slate-500 text-sm italic">
            การสนทนานี้ถูกปิดแล้ว
          </div>
        )}
      </div>
    </div>
  );
} 

