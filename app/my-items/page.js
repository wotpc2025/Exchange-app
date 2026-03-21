"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function MyItems() {
  const { data: session } = useSession();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exchangeModalItem, setExchangeModalItem] = useState(null);
  const [exchangePartners, setExchangePartners] = useState([]);
  const [selectedPartnerEmail, setSelectedPartnerEmail] = useState("");
  const [manualPartnerEmail, setManualPartnerEmail] = useState("");
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [savingExchange, setSavingExchange] = useState(false);

  // ดึงข้อมูลรายการของฉัน
  useEffect(() => {
    if (session?.user?.email) {
      fetch(`/api/items`)
        .then((res) => res.json())
        .then((data) => {
          const arr = Array.isArray(data) ? data : [];
          const myData = arr.filter((item) => item.owner_email === session.user.email);
          setItems(myData);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching items:", err);
          setLoading(false);
        });
    }
  }, [session]);

  // ✅ ฟังก์ชันอัปเดตสถานะ (available, pending, exchanged)
  const updateStatus = async (id, newStatus) => {
    let confirmMsg = "คุณแน่ใจหรือไม่ที่จะเปลี่ยนสถานะรายการนี้?";
    if (newStatus === 'pending') confirmMsg = "ยืนยันเปลี่ยนสถานะเป็น 'กำลังเจรจา'?";
    if (newStatus === 'available') confirmMsg = "ยืนยันคืนสถานะเป็น 'พร้อมแลก'?";
    if (newStatus === 'exchanged') confirmMsg = "ยืนยันว่าแลกเปลี่ยนสำเร็จแล้ว?";
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (res.ok) {
        setItems(items.map(item => item.id === id ? { ...item, status: newStatus } : item));
        if(newStatus === 'exchanged') alert("ยินดีด้วย! แลกเปลี่ยนสำเร็จแล้ว");
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
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

  const openExchangeModal = async (item) => {
    setExchangeModalItem(item);
    setSelectedPartnerEmail("");
    setManualPartnerEmail("");
    setLoadingPartners(true);
    setExchangePartners([]);

    try {
      const res = await fetch(`/api/items/${item.id}/exchange-partners`);
      const data = await res.json().catch(() => []);
      if (!res.ok) {
        alert(data?.error || "โหลดรายชื่อผู้ขอแลกไม่สำเร็จ");
        setExchangeModalItem(null);
        return;
      }

      const arr = Array.isArray(data) ? data : [];
      setExchangePartners(arr);
      if (arr.length === 1 && arr[0]?.requester_email) {
        setSelectedPartnerEmail(arr[0].requester_email);
      }
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการโหลดรายชื่อผู้ขอแลก");
      setExchangeModalItem(null);
    } finally {
      setLoadingPartners(false);
    }
  };

  const confirmExchangeWithPartner = async () => {
    if (!exchangeModalItem) return;

    const partnerEmail = (manualPartnerEmail.trim() || selectedPartnerEmail || "").trim();

    if (!partnerEmail) {
      alert("กรุณาเลือกหรือกรอกอีเมลผู้ที่แลกด้วย");
      return;
    }

    if (!window.confirm("ยืนยันว่าแลกเปลี่ยนสำเร็จกับผู้ใช้นี้?")) return;

    setSavingExchange(true);
    try {
      const res = await fetch(`/api/items/${exchangeModalItem.id}`, {
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
        prev.map((item) =>
          item.id === exchangeModalItem.id
            ? {
                ...item,
                status: "exchanged",
                exchanged_with_email: partnerEmail,
                exchanged_like_given: 0,
              }
            : item
        )
      );

      setExchangeModalItem(null);
      setExchangePartners([]);
      setSelectedPartnerEmail("");
      setManualPartnerEmail("");
      alert("ยืนยันแลกสำเร็จแล้ว และสามารถกดไลก์ผู้ใช้คนนี้ได้");
    } catch (error) {
      alert("เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    } finally {
      setSavingExchange(false);
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
            <Link href="/profile" className="text-slate-300 hover:text-amber-300 transition-colors text-sm font-semibold">
              โปรไฟล์
            </Link>
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
            items.map((item) => (
              <div key={item.id} className="glass-card p-6 flex flex-col border border-white/5 bg-white/5 rounded-[35px] hover:border-white/10 transition-all">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                  <div className="flex gap-5 items-center">
                    <div className="relative w-20 h-20 shrink-0">
                      <img src={item.image_url} className={`w-full h-full rounded-2xl object-cover shadow-lg ${item.status === 'exchanged' ? 'grayscale opacity-50' : ''}`} alt={item.title} />
                      {/* Badge แสดงสถานะปัจจุบัน */}
                      <div className={`absolute -top-2 -right-2 px-2 py-1 rounded-md text-[9px] font-bold uppercase shadow-xl 
                        ${item.approval_status !== 'approved' 
                          ? 'bg-amber-500 text-slate-950 border-amber-400/50' 
                          : item.status === 'available' 
                            ? 'bg-green-500 text-white' 
                            : item.status === 'pending' 
                              ? 'bg-blue-500 text-white' 
                              : 'bg-slate-700 text-slate-300'}`}
                      >
                        {item.approval_status !== 'approved' ? 'รออนุมัติ' : item.status}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{item.category}</span>
                      <h3 className="font-bold text-lg text-white leading-tight">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 italic">แลกกับ: {item.wishlist || "อะไรก็ได้"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* ปุ่มเปลี่ยนสถานะ, แก้ไข, ลบ: แสดงเฉพาะถ้าไม่ใช่ exchanged หรือ removed */}
                    {item.status !== 'exchanged' && item.status !== 'removed' && (
                      <>
                        <button 
                          onClick={() => updateStatus(item.id, item.status === 'available' ? 'pending' : 'available')}
                          className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all 
                          ${item.status === 'available' ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white' : 'border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white'}`}
                        >
                          {item.status === 'available' ? '⌛ กำลังเจรจา' : '✅ คืนสถานะพร้อมแลก'}
                        </button>
                        <button 
                          onClick={() => openExchangeModal(item)}
                          className="flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                        >
                          🤝 แลกสำเร็จแล้ว
                        </button>
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
                    {/* ถ้า exchanged หรือ removed ให้แสดงข้อความแทนปุ่ม */}
                    {(item.status === 'exchanged' || item.status === 'removed') && (
                      <div className="flex flex-col gap-2 text-xs text-slate-400 italic px-2 py-1">
                        {item.status === 'exchanged' ? (
                          <>
                            <span className="text-green-400 font-bold">แลกเปลี่ยนสำเร็จ</span>
                            {/* แสดงชื่อ/อีเมลผู้แลกเปลี่ยน ถ้ามี */}
                            {item.exchanged_with_email && (
                              <span> กับ <span className="text-amber-400">{item.exchanged_with_email}</span></span>
                            )}
                            {item.exchanged_with_email && (
                              Number(item.exchanged_like_given) === 1 ? (
                                <span className="text-pink-400 font-bold not-italic">คุณกดไลก์ผู้ใช้คนนี้แล้ว</span>
                              ) : (
                                <button
                                  onClick={() => handleLikeExchangedUser(item.id)}
                                  className="not-italic w-fit px-3 py-1.5 rounded-lg text-[11px] font-bold border border-pink-500/40 text-pink-300 hover:bg-pink-500 hover:text-white transition-all"
                                >
                                  👍 กดถูกใจผู้ใช้ที่แลกสำเร็จ
                                </button>
                              )
                            )}
                          </>
                        ) : (
                          <span className="text-red-400 font-bold">รายการนี้ถูกลบแล้ว</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-[40px] border border-dashed border-white/10 italic text-slate-500">
              ไม่มีรายการประกาศในขณะนี้
            </div>
          )}
          </div>
      </div>

      {exchangeModalItem && (
        <div className="fixed inset-0 z-[70] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg glass-card rounded-3xl border border-white/10 bg-slate-900/90 p-6">
            <h3 className="text-lg font-black text-amber-400">เลือกผู้ใช้ที่แลกสำเร็จ</h3>
            <p className="text-xs text-slate-400 mt-1">
              โพสต์: <span className="text-slate-200 font-semibold">{exchangeModalItem.title}</span>
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-slate-300 font-semibold">เลือกจากผู้ที่ยื่นคำขอแลก</label>
              <select
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white"
                value={selectedPartnerEmail}
                onChange={(e) => setSelectedPartnerEmail(e.target.value)}
                disabled={loadingPartners}
              >
                <option value="">-- เลือกผู้ใช้ --</option>
                {exchangePartners.map((partner) => (
                  <option key={partner.requester_email} value={partner.requester_email}>
                    {(partner.requester_name || "ไม่ระบุชื่อ")} ({partner.requester_email})
                  </option>
                ))}
              </select>

              <div className="text-[11px] text-slate-500">หรือกรอกอีเมลเอง (กรณีไม่ได้ผ่าน flow ยืนยันคำขอแลก)</div>
              <input
                type="email"
                value={manualPartnerEmail}
                onChange={(e) => setManualPartnerEmail(e.target.value)}
                placeholder="example@buu.ac.th"
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-3 py-2 text-sm text-white placeholder:text-slate-500"
              />
            </div>

            <div className="mt-5 flex gap-2 justify-end">
              <button
                onClick={() => setExchangeModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-white/20 text-slate-300 hover:bg-white/10 transition-all"
                disabled={savingExchange}
              >
                ยกเลิก
              </button>
              <button
                onClick={confirmExchangeWithPartner}
                className="px-4 py-2 rounded-xl text-xs font-bold border border-green-500/30 text-green-300 hover:bg-green-500 hover:text-white transition-all"
                disabled={savingExchange}
              >
                {savingExchange ? "กำลังบันทึก..." : "ยืนยันแลกสำเร็จ"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}