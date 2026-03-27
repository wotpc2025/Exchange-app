"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function MyItems() {
  const { data: session } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatusId, setUpdatingStatusId] = useState(null);
  const [markingExchangeId, setMarkingExchangeId] = useState(null);
  const [resubmittingId, setResubmittingId] = useState(null);

  const getThaiItemStatus = (rawStatus) => {
    const status = String(rawStatus || "").toLowerCase();
    if (status === "available") return "พร้อมแลก";
    if (status === "pending") return "กำลังเจรจา";
    if (status === "exchanged") return "แลกสำเร็จ";
    if (status === "removed") return "ถูกลบ";
    return "ไม่ระบุสถานะ";
  };

  const loadMyItems = async () => {
    if (!session?.user?.email) return;
    try {
      const res = await fetch(`/api/items`);
      const data = await res.json().catch(() => []);
      const arr = Array.isArray(data) ? data : [];
      const myData = arr.filter((item) => item.owner_email === session.user.email);
      setItems(myData);
    } catch (err) {
      console.error("Error fetching items:", err);
    } finally {
      setLoading(false);
    }
  };

  // ดึงข้อมูลรายการของฉัน
  useEffect(() => {
    if (session?.user?.email) {
      loadMyItems();
      // Polling เฉพาะถ้ามีประกาศที่ยังไม่ exchanged
      const interval = setInterval(() => {
        if (items.some((item) => item.status !== 'exchanged' && item.status !== 'removed')) {
          loadMyItems();
        } else {
          clearInterval(interval);
        }
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [session?.user?.email, items]);

  // ✅ ฟังก์ชันอัปเดตสถานะ (available, pending, exchanged)
  const updateStatus = async (id, newStatus) => {
    let confirmMsg = "คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะรายการนี้?";
    if (newStatus === 'pending') confirmMsg = "ยืนยันเปลี่ยนสถานะเป็น 'กำลังเจรจา'?";
    if (newStatus === 'available') confirmMsg = "ยืนยันคืนสถานะเป็น 'พร้อมแลก'?";
    if (newStatus === 'exchanged') confirmMsg = "ยืนยันว่าแลกเปลี่ยนสำเร็จแล้ว?";
    if (!window.confirm(confirmMsg)) return;

    setUpdatingStatusId(id);
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "เกิดข้อผิดพลาดในการอัปเดตสถานะ");
        return;
      }

      setItems((prev) => prev.map((item) => item.id === id ? { ...item, status: newStatus } : item));
      if(newStatus === 'exchanged') alert("ยินดีด้วย! แลกเปลี่ยนสำเร็จแล้ว");
      await loadMyItems();
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleDelete = async (id) => {
    if (confirm("คุณแน่ใจหรือไม่ที่จะลบประกาศนี้?")) {
      try {
        const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
        if (res.ok) {
          setItems(items.filter((item) => item.id !== id));
          alert("ลบรายการสำเร็จ!");
        }
      } catch (error) {
        alert("เกิดข้อผิดพลาดในการลบ");
      }
    }
  };

  const handleLikeExchangedUser = async (id) => {
    if (!window.confirm("ยืนยันกดไลก์ให้ผู้ใช้ที่แลกเปลี่ยนกับคุณ?")) return;

    try {
      const res = await fetch(`/api/items/${id}/like`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "กดไลก์ไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, exchanged_like_given: 1 } : item
        )
      );
      alert("กดไลก์เรียบร้อยแล้ว ขอบคุณสำหรับฟีดแบ็กครับ");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการกดไลก์");
    }
  };

  const markExchangedWithOnlyPartner = async (item) => {
    if (!window.confirm("ยืนยันว่าแลกเปลี่ยนสำเร็จแล้ว?")) return;

    setMarkingExchangeId(item.id);
    try {
      const partnerRes = await fetch(`/api/items/${item.id}/exchange-partners`);
      const partnerData = await partnerRes.json().catch(() => []);
      if (!partnerRes.ok) {
        alert(partnerData?.error || "โหลดข้อมูลผู้ขอแลกไม่สำเร็จ");
        return;
      }

      const partners = Array.isArray(partnerData) ? partnerData : [];
      if (partners.length !== 1 || !partners[0]?.requester_email) {
        alert("ระบบต้องมีผู้ขอแลกที่ยืนยันได้เพียง 1 คนต่อโพสต์ จึงจะตั้งสถานะแลกสำเร็จได้");
        return;
      }

      const partnerEmail = partners[0].requester_email;
      const res = await fetch(`/api/items/${item.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "exchanged",
          exchanged_with_email: partnerEmail,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data?.error || "อัปเดตสถานะแลกสำเร็จไม่สำเร็จ");
        return;
      }

      setItems((prev) =>
        prev.map((current) =>
          current.id === item.id
            ? {
                ...current,
                status: "exchanged",
                exchanged_with_email: partnerEmail,
                exchanged_like_given: 0,
              }
            : current
        )
      );

      alert("ยืนยันแลกสำเร็จแล้ว สามารถกดหัวใจให้ผู้ใช้ที่แลกด้วยได้");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      setMarkingExchangeId(null);
    }
  };

  const handleResubmitRejectedItem = async (id) => {
    if (!window.confirm("ยืนยันส่งโพสต์นี้กลับไปให้แอดมินตรวจสอบอีกครั้ง?")) return;

    setResubmittingId(id);
    try {
      const res = await fetch(`/api/items/${id}/resubmit`, { method: "POST" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(data?.error || "ส่งตรวจใหม่ไม่สำเร็จ");
        return;
      }

      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, approval_status: "pending" } : item
        )
      );
      alert("ส่งตรวจใหม่เรียบร้อยแล้ว");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการส่งตรวจใหม่");
    } finally {
      setResubmittingId(null);
    }
  };

  if (!session) return <div className="p-20 text-white text-center bg-[#020617] min-h-screen">กรุณาเข้าสู่ระบบ</div>;

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gold-gradient">
            BUU Exchange
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← กลับหน้าหลัก
            </Link>
          </div>
        </div>
      </nav>
    <div className="p-6 md:p-12">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <div className="min-w-0">
              <h1 className="text-3xl font-black text-amber-500">
                จัดการประกาศแลกของของฉัน
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                ดูและจัดการประกาศแลกของทั้งหมดที่คุณสร้างไว้ อัปเดตสถานะ หรือแก้ไขรายละเอียดได้ที่นี่
              </p>
            </div>
          </div>
          {loading ? (
            <div className="text-center py-10 text-slate-500">กำลังโหลดรายการของคุณ...</div>
          ) : items.length > 0 ? (
            items.map((item) => {
              const approvalStatus = String(item.approval_status || "").toLowerCase();
              const itemStatus = String(item.status || "").toLowerCase();
              const isRejected = approvalStatus === "rejected" || approvalStatus === "reject";
              const isApproved = approvalStatus === "approved";
              const canManageItem = isApproved && !isRejected && itemStatus !== "exchanged" && itemStatus !== "removed";

              return (
              <div key={item.id} className="glass-card p-6 flex flex-col border border-white/5 bg-white/5 rounded-[35px] hover:border-white/10 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                  <div className="flex gap-5 items-center">
                    <div className="relative w-20 h-20 shrink-0">
                      <img src={item.image_url} className={`w-full h-full rounded-2xl object-cover shadow-lg ${itemStatus === 'exchanged' ? 'grayscale opacity-50' : ''}`} alt={item.title} />
                      {/* Badge แสดงสถานะปัจจุบัน */}
                      <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-md text-[9px] font-bold uppercase shadow-xl 
                        ${isRejected
                          ? 'bg-red-500 text-white border-red-400/50'
                          : approvalStatus !== 'approved' 
                            ? 'bg-amber-500 text-slate-950 border-amber-400/50' 
                            : itemStatus === 'available' 
                              ? 'bg-green-500 text-white' 
                              : itemStatus === 'pending' 
                                ? 'bg-blue-500 text-white' 
                                : 'bg-slate-700 text-slate-300'}`}
                      >
                        {isRejected
                          ? 'ถูกปฏิเสธ'
                          : approvalStatus !== 'approved'
                            ? 'รอตรวจสอบ'
                            : getThaiItemStatus(itemStatus)}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{item.category}</span>
                      <h3 className="font-bold text-lg text-white leading-tight">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 italic">แลกกับ: {item.wishlist || "อะไรก็ได้"}</p>
                      {isRejected && (
                        <p className="text-xs text-red-400 mt-1 font-semibold">โพสต์นี้ถูกปฏิเสธโดยแอดมิน</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* ปุ่มเปลี่ยนสถานะ, แก้ไข, ลบ: แสดงเฉพาะถ้าไม่ใช่ exchanged หรือ removed */}
                    {canManageItem && (
                      <>
                        <button 
                          onClick={() => updateStatus(item.id, itemStatus === 'available' ? 'pending' : 'available')}
                          className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all 
                          ${itemStatus === 'available' ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white' : 'border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white'}`}
                          disabled={updatingStatusId === item.id}
                        >
                          {updatingStatusId === item.id
                            ? 'กำลังอัปเดต...'
                            : itemStatus === 'available'
                              ? '⌛ กำลังเจรจา'
                              : '✅ คืนสถานะพร้อมแลก'}
                        </button>
                        {/* เงื่อนไขใหม่: แสดงปุ่มแลกสำเร็จหลัง request completed ทั้งสองฝ่าย แต่ item ยังไม่ exchanged */}
                        {completedRequests && completedRequests[item.id] && itemStatus !== 'exchanged' && (
                          <button 
                            onClick={() => markExchangedWithOnlyPartner(item)}
                            className="flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                            disabled={markingExchangeId === item.id}
                          >
                            {markingExchangeId === item.id ? "กำลังบันทึก..." : "🤝 แลกสำเร็จแล้ว"}
                          </button>
                        )}
                        <Link href={`/items/${item.id}/edit`} className="flex-1 md:flex-none">
                          <button className="w-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-2 rounded-xl hover:bg-amber-500 hover:text-slate-950 transition-all font-bold text-xs">
                            แก้ไข
                          </button>
                        </Link>
                        <button onClick={() => handleDelete(item.id)} className="flex-1 md:flex-none bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all font-bold text-xs">
                          ลบ
                        </button>
                      </>
                    )}
                    {isRejected && (
                      <>
                        <Link href={`/items/${item.id}/edit`} className="flex-1 md:flex-none">
                          <button className="w-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-2 rounded-xl hover:bg-amber-500 hover:text-slate-950 transition-all font-bold text-xs">
                            แก้ไขโพสต์
                          </button>
                        </Link>
                        <button
                          onClick={() => handleResubmitRejectedItem(item.id)}
                          className="flex-1 md:flex-none bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 px-4 py-2 rounded-xl hover:bg-cyan-500 hover:text-slate-950 transition-all font-bold text-xs"
                          disabled={resubmittingId === item.id}
                        >
                          {resubmittingId === item.id ? "กำลังส่ง..." : "แก้ไขแล้วส่งตรวจใหม่"}
                        </button>
                      </>
                    )}
                    {/* ถ้า exchanged หรือ removed ให้แสดงข้อความแทนปุ่ม */}
                    {(itemStatus === 'exchanged' || itemStatus === 'removed' || isRejected) && (
                      <div className="flex flex-col gap-2 text-xs text-slate-400 italic px-2 py-1">
                        {itemStatus === 'exchanged' ? (
                          <>
                            <span className="text-green-400 font-bold">แลกเปลี่ยนสำเร็จ</span>
                            {/* แสดงชื่อ/อีเมลผู้แลกเปลี่ยน ถ้ามี */}
                            {item.exchanged_with_email && (
                              <span> กับ <span className="text-amber-400">{item.exchanged_with_email}</span></span>
                            )}
                            {item.exchanged_with_email && session?.user?.email === item.exchanged_with_email && (
                              Number(item.exchanged_like_given) === 1 ? (
                                <span className="text-pink-400 font-bold not-italic">คุณกดไลก์ผู้ใช้คนนี้แล้ว</span>
                              ) : (
                                <button
                                  onClick={() => handleLikeExchangedUser(item.id)}
                                  className="not-italic w-fit px-3 py-1.5 rounded-lg text-[11px] font-bold border border-pink-500/40 text-pink-300 hover:bg-pink-500 hover:text-white transition-all"
                                >
                                  ❤ กดหัวใจให้ผู้ใช้ที่แลกด้วย
                                </button>
                              )
                            )}
                          </>
                        ) : isRejected ? (
                          <span className="text-red-400 font-bold">รายการนี้ถูกแอดมินปฏิเสธ</span>
                        ) : (
                          <span className="text-red-400 font-bold">รายการนี้{getThaiItemStatus(itemStatus)}แล้ว</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )})
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-[40px] border border-dashed border-white/10 italic text-slate-500">
              ไม่มีรายการประกาศในขณะนี้
            </div>
          )}
          </div>
      </div>

    </div>
  );
}