"use client";
import { useState, useEffect } from "react";
  const [interestedCount, setInterestedCount] = useState(0);
  // Fetch interested count
  useEffect(() => {
    if (!id) return;
    fetch(`/api/requests/count?item_id=${id}`)
      .then(res => res.ok ? res.json() : { count: 0 })
      .then(data => setInterestedCount(data.count || 0))
      .catch(() => setInterestedCount(0));
  }, [id]);
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";

export default function ItemDetail({ params }) {
  const pathname = usePathname();
  const id = pathname?.split("/").filter(Boolean).pop();

  const { data: session } = useSession();
  const router = useRouter();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showComplaint, setShowComplaint] = useState(false);
  const [complaintReason, setComplaintReason] = useState("");
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [myRequest, setMyRequest] = useState(null);

  useEffect(() => {
    const fetchItem = async () => {
      if (!id) return;
      try {
        const res = await fetch(`/api/items/${id}`);
        if (res.ok) {
          const data = await res.json();
          setItem(data);
        }
      } catch (error) {
        console.error("Fetch error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchItem();
  }, [id]);

  useEffect(() => {
    const fetchMyRequest = async () => {
      if (!id || !session?.user?.email) return;
      try {
        const res = await fetch(`/api/requests?user=${encodeURIComponent(session.user.email)}&item_id=${id}`);
        if (res.ok) {
          const data = await res.json();
          // คืนค่า request ล่าสุด (desc order) ที่ผู้ใช้เป็น requester
          setMyRequest(Array.isArray(data) && data.length > 0 ? data[0] : null);
        }
      } catch (error) {
        console.error("Fetch request error:", error);
      }
    };
    fetchMyRequest();
  }, [id, session?.user?.email]);

  const itemImages = Array.isArray(item?.images) && item.images.length > 0
    ? item.images
    : item?.image_url
      ? [item.image_url]
      : [];

  useEffect(() => {
    setActiveImageIndex(0);
  }, [item?.id]);

  const goPrevImage = () => {
    if (!itemImages.length) return;
    setActiveImageIndex((prev) => (prev - 1 + itemImages.length) % itemImages.length);
  };

  const goNextImage = () => {
    if (!itemImages.length) return;
    setActiveImageIndex((prev) => (prev + 1) % itemImages.length);
  };

  // ✅ ฟังก์ชันเริ่มการเจรจา (สร้าง Exchange Request และไปหน้าแชท)
  const startNegotiation = async () => {
    if (!session) {
      alert("กรุณาเข้าสู่ระบบก่อนเริ่มการเจรจา");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_id: item.id,
          requester_email: session.user.email,
          owner_email: item.owner_email,
          offered_item: "เริ่มการเจรจาใหม่" // ข้อความเริ่มต้น
        })
      });

      const data = await res.json();
      if (res.ok) {
        // ป้องกันกรณี backend ส่ง id ผิดรูปแบบ เช่น "7/1" หรือ array
        let chatId = data.id;
        if (Array.isArray(chatId)) chatId = chatId[0];
        if (typeof chatId === "string" && chatId.includes("/")) {
          console.error("[BUG] Unexpected chat id format from backend:", chatId);
          chatId = chatId.split("/")[0];
        }
        if (!chatId || isNaN(Number(chatId))) {
          alert("เกิดข้อผิดพลาด: รหัสห้องแชทไม่ถูกต้อง");
          return;
        }
        router.push(`/chat/${chatId}`);
      } else {
        alert("เกิดข้อผิดพลาด: " + data.error);
      }
    } catch (error) {
      console.error("Negotiation error:", error);
      alert("ไม่สามารถเริ่มการเจรจาได้ในขณะนี้");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitComplaint = async (e) => {
    e.preventDefault();
    if (!session) {
      alert("กรุณาเข้าสู่ระบบก่อนทำรายการร้องเรียน");
      return;
    }

    if (!confirm("ยืนยันส่งคำร้องเรียนประกาศนี้?")) return;

    setComplaintSubmitting(true);
    try {
      const res = await fetch(`/api/items/${id}/complaint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: complaintReason }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("ส่งคำร้องเรียนไม่สำเร็จ: " + (data.error || "unknown error"));
        return;
      }

      setComplaintReason("");
      setShowComplaint(false);
      alert("ส่งคำร้องเรียนเรียบร้อยแล้ว");
    } catch (error) {
      console.error("Complaint error:", error);
      alert("ไม่สามารถส่งคำร้องเรียนได้ในขณะนี้");
    } finally {
      setComplaintSubmitting(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-white bg-[#020617]">กำลังโหลดข้อมูล...</div>;
  if (!item) return <div className="min-h-screen flex items-center justify-center text-white bg-[#020617]">ไม่พบสินค้านี้ในระบบ</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white py-20 px-6">
      <div className="max-w-5xl mx-auto">
        <button onClick={() => router.back()} className="mb-8 text-amber-500 flex items-center gap-2 hover:underline">
          ← ย้อนกลับไปหน้าหลัก
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          {/* ส่วนโชว์รูปภาพ */}
          <div className="glass-card p-4 rounded-[40px] border border-white/5 bg-slate-900/50">
            {itemImages.length > 0 ? (
              <div>
                <div className="relative">
                  <img
                    src={itemImages[activeImageIndex]}
                    alt={item.title}
                    className="w-full rounded-[30px] shadow-2xl object-cover max-h-[520px]"
                  />
                  {itemImages.length > 1 && (
                    <>
                      <button
                        onClick={goPrevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 border border-white/20 text-white"
                      >
                        ←
                      </button>
                      <button
                        onClick={goNextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/50 border border-white/20 text-white"
                      >
                        →
                      </button>
                      <span className="absolute bottom-3 right-3 text-[11px] font-black px-3 py-1 rounded-full bg-black/60 border border-white/20">
                        {activeImageIndex + 1}/{itemImages.length}
                      </span>
                    </>
                  )}
                </div>

                {itemImages.length > 1 && (
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {itemImages.map((src, idx) => (
                      <button
                        key={`thumb-${idx}`}
                        onClick={() => setActiveImageIndex(idx)}
                        className={`rounded-xl overflow-hidden border ${idx === activeImageIndex ? "border-amber-400" : "border-white/10"}`}
                      >
                        <img src={src} alt={`thumb-${idx}`} className="h-16 w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="aspect-square flex items-center justify-center text-slate-500 italic border border-dashed border-white/10 rounded-[30px]">ไม่มีรูปภาพประกอบ</div>
            )}
          </div>

          {/* ส่วนข้อมูลรายละเอียด */}
          <div className="flex flex-col justify-center">
            <span className="text-amber-500 font-bold uppercase tracking-widest text-sm mb-2">{item.category}</span>
            {interestedCount > 0 && (
              <span className="ml-2 inline-block bg-blue-900/60 text-blue-300 border border-blue-500/30 rounded-full px-3 py-1 text-xs font-bold align-middle">
                มีคนสนใจ {interestedCount} คน
              </span>
            )}
            <h1 className="text-5xl font-black mb-4 text-white leading-tight">{item.title}</h1>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">{item.description}</p>
            
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-8 mb-8">
              <p className="text-amber-500 text-xs font-black uppercase mb-2 tracking-widest">สิ่งที่อยากแลกด้วย</p>
              <p className="text-3xl font-bold italic text-amber-200">"{item.wishlist || "อะไรก็ได้"}"</p>
            </div>

            <div className="flex flex-col gap-4">
               <p className="text-sm text-slate-500">ลงประกาศเมื่อ: {new Date(item.created_at).toLocaleDateString('th-TH')}</p>
               
               {/* เช็คว่าเป็นเจ้าของเองหรือไม่ ถ้าไม่ใช่ถึงจะโชว์ปุ่มแชท (admin ดูได้อย่างเดียว) */}
               {session?.user?.role === "admin" ? (
                 <div className="bg-slate-800/50 border border-white/10 p-4 rounded-2xl text-center italic text-slate-400">
                   คุณเป็นแอดมิน จึงดูรายละเอียดได้อย่างเดียว
                 </div>
               ) : session?.user?.email !== item.owner_email ? (
                 <>
                   {/* Badge สถานะคำขอปัจจุบัน */}
                   {myRequest?.status === "pending" && (
                     <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                       <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
                       <div>
                         <p className="text-blue-300 font-black text-sm">รอการตอบรับ</p>
                         <p className="text-slate-500 text-xs mt-0.5">เจ้าของยังไม่ตอบรับคำขอของคุณ</p>
                       </div>
                       <button
                         onClick={() => router.push(`/chat/${myRequest.id}`)}
                         className="ml-auto text-xs font-black text-blue-300 border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-xl transition-all"
                       >
                         ไปห้องแชท →
                       </button>
                     </div>
                   )}

                   {myRequest?.status === "accepted" && (
                     <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/20 p-4 rounded-2xl">
                       <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shrink-0"></span>
                       <div>
                         <p className="text-green-300 font-black text-sm">ตอบรับแล้ว — กำลังเจรจา</p>
                         <p className="text-slate-500 text-xs mt-0.5">เจ้าของรับคำขอของคุณแล้ว</p>
                       </div>
                       <button
                         onClick={() => router.push(`/chat/${myRequest.id}`)}
                         className="ml-auto text-xs font-black text-green-300 border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 px-3 py-1.5 rounded-xl transition-all"
                       >
                         ไปห้องแชท →
                       </button>
                     </div>
                   )}

                   {myRequest?.status === "rejected" && (
                     <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 p-4 rounded-2xl">
                       <span className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0"></span>
                       <div>
                         <p className="text-red-300 font-black text-sm">คำขอถูกปฏิเสธ</p>
                         <p className="text-slate-500 text-xs mt-0.5">คุณสามารถส่งคำขอใหม่ได้</p>
                       </div>
                     </div>
                   )}

                   {myRequest?.status === "completed" && (
                     <div className="flex items-center gap-3 bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
                       <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0"></span>
                       <div>
                         <p className="text-emerald-300 font-black text-sm">แลกสำเร็จแล้ว 🎉</p>
                         <p className="text-slate-500 text-xs mt-0.5">การแลกเปลี่ยนนี้เสร็จสิ้นแล้ว</p>
                       </div>
                       <button
                         onClick={() => router.push(`/chat/${myRequest.id}`)}
                         className="ml-auto text-xs font-black text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-1.5 rounded-xl transition-all"
                       >
                         ดูห้องแชท →
                       </button>
                     </div>
                   )}

                   {/* แสดงปุ่มขอแลกเฉพาะเมื่อยังไม่มีคำขอ หรือถูกปฏิเสธแล้ว (ขอใหม่ได้) */}
                   {(!myRequest || myRequest.status === "rejected") && (
                     <button
                       onClick={startNegotiation}
                       disabled={isSubmitting}
                       className="gold-glow bg-amber-500 text-slate-950 font-black py-5 px-8 rounded-2xl text-center text-xl hover:bg-amber-400 transition-all disabled:opacity-50"
                     >
                       {isSubmitting ? "กำลังเปิดห้องแชท..." : myRequest?.status === "rejected" ? "💬 ขอแลกใหม่" : "💬 ทักแชทเจรจาขอแลก"}
                     </button>
                   )}

                   <button
                     onClick={() => {
                       if (!session) {
                         alert("กรุณาเข้าสู่ระบบก่อนทำรายการร้องเรียน");
                         return;
                       }
                       setShowComplaint(true);
                     }}
                     className="bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 px-6 py-4 rounded-2xl transition-all font-black text-sm uppercase tracking-widest"
                   >
                     🚩 ร้องเรียนประกาศ
                   </button>
                 </>
               ) : (
                 <div className="bg-slate-800/50 border border-white/10 p-4 rounded-2xl text-center italic text-slate-400">
                   นี่คือรายการของคุณเอง
                 </div>
               )}
              
              <p className="text-center text-xs text-slate-600 italic">
                เจ้าของ:{" "}
                {item.owner_id ? (
                  <Link
                    href={`/users/${item.owner_id}`}
                    className="underline-offset-2 hover:underline"
                  >
                    {item.owner_name || item.owner_email}
                  </Link>
                ) : (
                  item.owner_name || item.owner_email
                )}
              </p>
            </div>

            {showComplaint && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                <div className="glass-card w-full max-w-lg rounded-[30px] border border-white/10 bg-slate-950/70 backdrop-blur-md p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-black text-red-300">ร้องเรียนประกาศ</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        กรุณาระบุเหตุผล (ไม่บังคับ) เพื่อให้แอดมินตรวจสอบได้เร็วขึ้น
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setShowComplaint(false);
                        setComplaintReason("");
                      }}
                      className="text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>

                  <form onSubmit={submitComplaint} className="mt-4 space-y-4">
                    <textarea
                      className="w-full bg-slate-900/60 rounded-2xl p-4 outline-none border border-white/10 focus:border-red-400/50 transition-all text-sm"
                      rows={5}
                      placeholder="พิมพ์เหตุผล เช่น โพสต์ไม่เหมาะสม, หลอกลวง, สแปม..."
                      value={complaintReason}
                      onChange={(e) => setComplaintReason(e.target.value)}
                    />

                    <div className="flex gap-3 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setShowComplaint(false);
                          setComplaintReason("");
                        }}
                        className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border border-white/10 text-slate-300 hover:bg-white/5 transition-all"
                      >
                        ยกเลิก
                      </button>
                      <button
                        disabled={complaintSubmitting}
                        className="px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-200 disabled:opacity-60 transition-all"
                      >
                        {complaintSubmitting ? "กำลังส่ง..." : "ส่งคำร้องเรียน"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}