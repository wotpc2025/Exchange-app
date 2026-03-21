"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MyItems() {
  const { data: session } = useSession();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

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
        .catch((err) => console.error("Error fetching items:", err));
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

  if (!session) return <div className="p-20 text-white text-center bg-[#020617] min-h-screen">กรุณาเข้าสู่ระบบ</div>;

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
                        ${item.status === 'available' ? 'bg-green-500 text-white' : item.status === 'pending' ? 'bg-blue-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                        {item.status}
                      </div>
                    </div>
                    <div>
                      <span className="text-[10px] text-amber-500 font-bold uppercase tracking-widest">{item.category}</span>
                      <h3 className="font-bold text-lg text-white leading-tight">{item.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 italic">แลกกับ: {item.wishlist || "อะไรก็ได้"}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    {/* ส่วนของปุ่มเปลี่ยนสถานะ */}
                    {item.status !== 'exchanged' && (
                      <>
                        <button 
                          onClick={() => updateStatus(item.id, item.status === 'available' ? 'pending' : 'available')}
                          className={`flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border transition-all 
                          ${item.status === 'available' ? 'border-blue-500/30 text-blue-400 hover:bg-blue-500 hover:text-white' : 'border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white'}`}
                        >
                          {item.status === 'available' ? '⌛ กำลังเจรจา' : '✅ คืนสถานะพร้อมแลก'}
                        </button>
                        
                        <button 
                          onClick={() => updateStatus(item.id, 'exchanged')}
                          className="flex-1 md:flex-none px-4 py-2 rounded-xl text-xs font-bold border border-green-500/30 text-green-400 hover:bg-green-500 hover:text-white transition-all"
                        >
                          🤝 แลกสำเร็จแล้ว
                        </button>
                      </>
                    )}

                    <Link href={`/items/${item.id}/edit`} className="flex-1 md:flex-none">
                      <button className="w-full bg-amber-500/10 text-amber-500 border border-amber-500/20 px-4 py-2 rounded-xl hover:bg-amber-500 hover:text-slate-950 transition-all font-bold text-xs">
                        แก้ไข
                      </button>
                    </Link>

                    <button onClick={() => handleDelete(item.id)} className="flex-1 md:flex-none bg-red-500/10 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl hover:bg-red-500 hover:text-white transition-all font-bold text-xs">
                      ลบ
                    </button>
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
    </div>
  );
}