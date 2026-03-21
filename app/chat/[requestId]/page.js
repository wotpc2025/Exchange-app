"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export default function ChatRoom({ params }) {
  // ✅ แกะ requestId จาก params
  const pathname = usePathname();
  const requestId = pathname?.split("/").filter(Boolean).pop();

  const { data: session } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState([]);
  const [requestInfo, setRequestInfo] = useState(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    punctuality: 5,
    accuracy: 5,
    politeness: 5,
    comment: "",
  });

  const getThaiRequestStatus = (rawStatus) => {
    const status = String(rawStatus || "").toLowerCase();
    if (status === "pending") return "รอการตอบรับ";
    if (status === "accepted") return "ตอบรับแล้ว";
    if (status === "rejected") return "ปฏิเสธแล้ว";
    if (status === "completed") return "แลกสำเร็จแล้ว";
    return "ไม่ทราบสถานะ";
  };

  // 1. ฟังก์ชันดึงข้อมูล (ดึงทั้งข้อมูลคำขอและข้อความ)
  const fetchData = async () => {
    try {
      const res = await fetch(`/api/chat/${requestId}`);
        if (res.ok) {
        const data = await res.json();
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setRequestInfo(data.request || null);
      }
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // 2. Setup Real-time (Polling ทุก 3 วินาที)
  useEffect(() => {
    if (!requestId) return;
    
    fetchData(); // ดึงครั้งแรกทันที

    const interval = setInterval(() => {
      fetchData();
    }, 3000); // ดึงใหม่ทุก 3 วินาที

    return () => clearInterval(interval); // เคลียร์เมื่อปิดหน้าจอ
  }, [requestId]);

  // 3. ฟังก์ชันส่งข้อความ
  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || !session) return;

    const currentInput = input;
    setInput(""); // ล้างช่องพิมพ์ทันที (Optimistic)

    try {
      const res = await fetch(`/api/chat/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_email: session.user.email,
          message_text: currentInput,
        }),
      });

      if (res.ok) {
        fetchData(); // ดึงข้อมูลใหม่เพื่อโชว์ข้อความที่เพิ่งส่ง
      }
    } catch (error) {
      alert("ไม่สามารถส่งข้อความได้");
    }
  };

  // 4. ฟังก์ชันตัดสินใจ (Accept/Reject)
  const handleDecision = async (newStatus) => {
    if (!confirm(`คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะเป็น ${getThaiRequestStatus(newStatus)}?`)) return;

    try {
      const res = await fetch(`/api/requests/${requestId}`, {
        method: 'PUT',
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        alert(`ดำเนินการสำเร็จ!`);
        fetchData(); // อัปเดตข้อมูลหน้าจอ
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาด");
    }
  };

  const confirmExchange = async () => {
    if (!confirm("ยืนยันว่าแลกเปลี่ยนสำเร็จแล้ว?")) return;
    try {
      const res = await fetch(`/api/requests/${requestId}/confirm`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ยืนยันไม่สำเร็จ");
        return;
      }
      alert(
        data.bothConfirmed
          ? "ยืนยันครบ 2 ฝ่ายแล้ว! ระบบจะปิดดีลให้ทันที"
          : "ยืนยันสำเร็จ รออีกฝ่ายกดยืนยัน"
      );
      fetchData();
    } catch (error) {
      alert("ยืนยันไม่สำเร็จ");
    }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    setReviewBusy(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reviewForm),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || "ส่งรีวิวไม่สำเร็จ");
        return;
      }
      alert("ขอบคุณสำหรับการรีวิว!");
      setReviewOpen(false);
      fetchData();
    } finally {
      setReviewBusy(false);
    }
  };

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">กำลังเข้าสู่ห้องเจรจา...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#020617] text-white">
      {/* Header: ข้อมูลของที่แลก + ปุ่มตัดสินใจ */}
      <div className="p-4 border-b border-white/10 glass-card flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="mr-2 text-slate-400 hover:text-white">←</button>
          <img src={requestInfo?.item_image} className="w-12 h-12 rounded-xl object-cover border border-white/10" alt="" />
          <div>
            <h2 className="font-bold text-sm md:text-base line-clamp-1">{requestInfo?.item_title}</h2>
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full animate-pulse ${requestInfo?.status === 'pending' ? 'bg-blue-500' : requestInfo?.status === 'accepted' ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">สถานะ: {getThaiRequestStatus(requestInfo?.status)}</p>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {requestInfo?.owner_id ? (
                <>
                  เจ้าของ:{" "}
                  <Link
                    href={`/users/${requestInfo.owner_id}`}
                    className="hover:underline underline-offset-2"
                  >
                    {requestInfo.owner_name || requestInfo.owner_email}
                  </Link>
                </>
              ) : (
                <>เจ้าของ: {requestInfo?.owner_email}</>
              )}
              {"  "}·{"  "}
              {requestInfo?.requester_id ? (
                <>
                  ผู้ขอแลก:{" "}
                  <Link
                    href={`/users/${requestInfo.requester_id}`}
                    className="hover:underline underline-offset-2"
                  >
                    {requestInfo.requester_name || requestInfo.requester_email}
                  </Link>
                </>
              ) : (
                <>ผู้ขอแลก: {requestInfo?.requester_email}</>
              )}
            </p>
          </div>
        </div>

        {/* ส่วนปุ่มกดสำหรับเจ้าของสินค้า */}
        {requestInfo?.owner_email === session?.user?.email && requestInfo?.status === 'pending' && (
          <div className="flex gap-2">
            <button 
              onClick={() => handleDecision('accepted')} 
              className="bg-green-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs hover:bg-green-400 transition-all"
            >
              รับแลก
            </button>
            <button 
              onClick={() => handleDecision('rejected')} 
              className="bg-red-500/20 text-red-400 px-4 py-2 rounded-xl text-xs border border-red-500/30 hover:bg-red-500 hover:text-white transition-all"
            >
              ปฏิเสธ
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          {(requestInfo?.status === "accepted" || requestInfo?.status === "completed") && (
            <button
              onClick={confirmExchange}
              className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              ยืนยันแลกสำเร็จ
            </button>
          )}

          {requestInfo?.status === "completed" && (
            <button
              onClick={() => setReviewOpen(true)}
              className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              ให้คะแนน/รีวิว
            </button>
          )}
        </div>
      </div>

      {reviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="glass-card w-full max-w-lg rounded-[30px] border border-white/10 bg-slate-950/70 backdrop-blur-md p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-emerald-300">
                  รีวิวหลังแลกเปลี่ยนสำเร็จ
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  ให้คะแนนความตรงต่อเวลา/ตรงปก/มารยาท (1-5)
                </p>
              </div>
              <button
                onClick={() => setReviewOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={submitReview} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="text-xs text-slate-300">
                  ตรงต่อเวลา
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={reviewForm.punctuality}
                    onChange={(e) =>
                      setReviewForm((v) => ({
                        ...v,
                        punctuality: Number(e.target.value || 5),
                      }))
                    }
                    className="mt-1 w-full bg-slate-900/60 rounded-2xl p-3 outline-none border border-white/10 focus:border-emerald-400/50 transition-all text-sm"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  ตรงปก
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={reviewForm.accuracy}
                    onChange={(e) =>
                      setReviewForm((v) => ({
                        ...v,
                        accuracy: Number(e.target.value || 5),
                      }))
                    }
                    className="mt-1 w-full bg-slate-900/60 rounded-2xl p-3 outline-none border border-white/10 focus:border-emerald-400/50 transition-all text-sm"
                  />
                </label>
                <label className="text-xs text-slate-300">
                  มารยาท
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={reviewForm.politeness}
                    onChange={(e) =>
                      setReviewForm((v) => ({
                        ...v,
                        politeness: Number(e.target.value || 5),
                      }))
                    }
                    className="mt-1 w-full bg-slate-900/60 rounded-2xl p-3 outline-none border border-white/10 focus:border-emerald-400/50 transition-all text-sm"
                  />
                </label>
              </div>

              <textarea
                value={reviewForm.comment}
                onChange={(e) =>
                  setReviewForm((v) => ({ ...v, comment: e.target.value }))
                }
                rows={4}
                placeholder="ความคิดเห็นเพิ่มเติม (ไม่บังคับ)"
                className="w-full bg-slate-900/60 rounded-2xl p-4 outline-none border border-white/10 focus:border-emerald-400/50 transition-all text-sm resize-none"
              />

              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setReviewOpen(false)}
                  className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-300 hover:bg-white/5 transition-all"
                >
                  ยกเลิก
                </button>
                <button
                  disabled={reviewBusy}
                  className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-200 disabled:opacity-60 transition-all"
                >
                  {reviewBusy ? "กำลังส่ง..." : "ส่งรีวิว"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* บอดี้แชท */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]">
        {messages.length > 0 ? (
          messages.map((msg, i) => {
            const key = msg?.id ?? `msg-${i}-${msg?.created_at ?? ""}`;
            return (
            <div key={key} className={`flex flex-col ${msg.sender_email === session?.user?.email ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-lg ${
                msg.sender_email === session?.user?.email 
                ? 'bg-amber-500 text-slate-950 rounded-tr-none' 
                : 'bg-slate-800 text-white rounded-tl-none'
              }`}>
                <p className="text-sm">{msg.message_text}</p>
              </div>
              <span className="text-[9px] text-slate-500 mt-1">
                {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            )
          })
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500 italic text-sm text-center p-10">
            เริ่มการสนทนาเพื่อตกลงการแลกเปลี่ยนได้เลย!
          </div>
        )}
      </div>

      {/* ช่องพิมพ์ข้อความ */}
      <div className="p-4 bg-slate-900 border-t border-white/10">
        {requestInfo?.status === 'pending' ? (
          <form className="flex gap-2 max-w-4xl mx-auto" onSubmit={sendMessage}>
            <input 
              className="flex-1 bg-slate-800 border-none rounded-2xl px-5 py-3 outline-none focus:ring-2 ring-amber-500/50 transition-all text-sm"
              placeholder="พิมพ์ข้อความเจรจา..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-6 py-3 rounded-2xl font-black text-sm transition-all shadow-lg shadow-amber-500/20">
              ส่ง
            </button>
          </form>
        ) : (
          <div className="text-center p-2 text-slate-500 text-sm italic">
            การเจรจานี้ยุติลงแล้วเนื่องจากสถานะคือ: {requestInfo?.status}
          </div>
        )}
      </div>
    </div>
  );
}