"use client";
import { useState, useEffect } from "react";
import { categories } from "@/lib/categories";
import { useSession, signOut, signIn } from "next-auth/react";
import Link from "next/link";
import NotificationBell from "@/components/NotificationBell";

export default function HomePage() {
  const { data: session } = useSession();
  const [items, setItems] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [activeRequestCount, setActiveRequestCount] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ทั้งหมด");

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/items");
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    const loadActiveRequests = async () => {
      if (!session?.user?.email || session.user?.role !== "student") {
        setActiveRequestCount(0);
        return;
      }

      try {
        const res = await fetch(`/api/requests?user=${encodeURIComponent(session.user.email)}`);
        const data = await res.json();
        const rows = Array.isArray(data) ? data : [];
        const activeCount = rows.filter((r) => String(r.status || "").toLowerCase() === "pending").length;
        setActiveRequestCount(activeCount);
      } catch {
        setActiveRequestCount(0);
      }
    };

    loadActiveRequests();
  }, [session?.user?.email, session?.user?.role]);

  // ✅ กรองหน้าแรก: อนุมัติแล้วเท่านั้น, ไม่ถูกลบ, และยังไม่แลกสำเร็จ
  const filteredItems = items.filter((item) => {
    const approval = (item.approval_status || "").toLowerCase();
    const status = (item.status || "").toLowerCase();
    const isApproved = approval === "approved";
    const isNotRemoved = approval !== "removed" && status !== "removed";
    const isNotExchanged = status !== "exchanged";
    const matchesSearch = (item.title || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === "ทั้งหมด" || item.category === selectedCategory;
    return isApproved && isNotRemoved && isNotExchanged && matchesSearch && matchesCategory;
  }).sort((a, b) => {
    // เหลือเฉพาะ available/pending จึงเรียงให้พร้อมแลกขึ้นก่อน
    const order = { 'available': 1, 'pending': 2 };
    return (order[a.status] || 1) - (order[b.status] || 1);
  });

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      {/* --- Navigation Bar --- */}
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gold-gradient">
            BUU Exchange
          </Link>

          <div className="flex items-center gap-4 md:gap-6">
            {session ? (
              <>
                <NotificationBell />

                {session.user?.role === "student" && (
                  <>
                    <Link href="/my-items" className="relative group">
                      <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 group-hover:border-amber-500/50 transition-all flex items-center justify-center text-xl">
                        🪧ประกาศของฉัน
                      </div>
                    </Link>

                    <Link href="/requests" className="relative group">
                      <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 group-hover:border-amber-500/50 transition-all flex items-center justify-center text-xl">
                        💬กล่องข้อความ
                      </div>
                      {activeRequestCount > 0 && (
                        <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-amber-500 border-2 border-[#020617] text-[9px] font-black text-slate-950">
                          {activeRequestCount > 99 ? "99+" : activeRequestCount}
                        </span>
                      )}
                    </Link>

                    <Link href="/support" className="relative group">
                      <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 group-hover:border-amber-500/50 transition-all flex items-center justify-center text-xl">
                        📞ติดต่อแอดมิน
                      </div>
                    </Link>
                  </>
                )}

                <Link href="/profile" className="relative group">
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 group-hover:border-amber-500/50 transition-all flex flex-col items-start justify-center">
                    <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest leading-tight">
                      {session.user.role === "admin" ? "แอดมิน" : "นักศึกษา"}
                    </p>
                    <p className="text-sm text-slate-200 font-medium">
                      {session.user.name}
                    </p>
                  </div>
                </Link>

                {session.user.role === "admin" && (
                  <Link
                    href="/admin"
                    className="text-[10px] font-black bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 px-4 py-2 rounded-xl uppercase tracking-widest"
                  >
                    Admin Panel
                  </Link>
                )}

                <button
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="text-[10px] font-black bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-4 py-2 rounded-xl transition-all uppercase"
                >
                  Logout
                </button>
              </>
            ) : (
              <button
                onClick={() => signIn("google")}
                className="gold-glow text-xs bg-amber-500 text-slate-950 font-bold px-5 py-2 rounded-full"
              >
                LOGIN
              </button>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* --- Header Section --- */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6 text-left">
          <div className="max-w-xl">
            <h2 className="text-4xl md:text-5xl font-black mb-4 text-amber-500 leading-tight">ของกิน ของใช้ <br/><span className="text-amber-500">แลกได้ที่นี่</span></h2>
            <p className="text-slate-400 text-lg italic">"BUU Exchange: มิตรภาพเริ่มได้จากการแบ่งปัน"</p>
          </div>
          {session && session.user?.role !== "admin" && (
            <Link href="/add-item">
              <button className="gold-glow bg-amber-500 hover:bg-amber-400 text-slate-950 font-black py-4 px-10 rounded-2xl transition-all uppercase tracking-wider text-lg">+ ลงประกาศแลกของ</button>
            </Link>
          )}
        </div>

        {/* --- Search & Filter UI --- */}
        <div className="flex flex-col md:flex-row gap-4 mb-10">
          <div className="flex-1 relative group">
            <input 
              type="text" 
              placeholder="ค้นหาสิ่งของที่คุณต้องการ..." 
              className="w-full bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-amber-500 transition-all text-white"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="absolute right-5 top-4 opacity-30">🔍</span>
          </div>
          <select 
            className="bg-slate-900/50 border border-white/10 rounded-2xl py-4 px-6 outline-none focus:border-amber-500 cursor-pointer text-white appearance-none min-w-[180px]"
            onChange={(e) => setSelectedCategory(e.target.value)}
            value={selectedCategory}
          >
            <option value="ทั้งหมด">ทุกหมวดหมู่</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* --- รายการสินค้า --- */}
        {loading ? (
          <div className="text-center py-20 text-slate-500 italic animate-pulse">กำลังดึงข้อมูลล่าสุด...</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => (
                <Link href={`/items/${item.id}`} key={item.id} className="block group">
                  <div className="glass-card rounded-[35px] p-2 hover:scale-[1.02] transition-all cursor-pointer border border-white/5 hover:border-amber-500/30 bg-slate-900/40 backdrop-blur-sm h-full flex flex-col relative overflow-hidden">
                    
                    {/* ✅ ส่วนภาพและ Badge สถานะ */}
                    <div className="aspect-[4/5] bg-slate-800 rounded-[30px] mb-4 overflow-hidden relative shadow-inner">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${item.status === 'exchanged' ? 'grayscale opacity-50' : ''}`} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600 italic text-sm">ไม่มีรูปภาพ</div>
                      )}

                      {/* ✅ Status Badge (มุมซ้ายบน) */}
                      <div className="absolute top-4 left-4 flex flex-col gap-2">
                        <span className={`text-[9px] font-black px-3 py-1.5 rounded-full border backdrop-blur-md shadow-lg uppercase tracking-widest ${
                          item.status === 'exchanged' 
                            ? 'bg-slate-900/90 text-slate-400 border-white/10' 
                            : item.status === 'pending'
                            ? 'bg-amber-500/90 text-slate-950 border-amber-400/50'
                            : 'bg-green-500/90 text-slate-950 border-green-400/50'
                        }`}>
                          {item.status === 'exchanged' ? '● แลกเปลี่ยนแล้ว' : item.status === 'pending' ? '● มีคนสนใจ' : '● พร้อมแลก'}
                        </span>
                      </div>

                      {/* หมวดหมู่ (มุมขวาบน) */}
                      <span className="absolute top-4 right-4 text-[9px] font-black bg-slate-950/80 backdrop-blur-md text-amber-400 px-3 py-1.5 rounded-full border border-white/10 uppercase tracking-widest">
                        {item.category}
                      </span>
                    </div>

                    <div className="px-4 pb-4 flex-1 flex flex-col">
                      <h3 className="font-bold text-xl text-white group-hover:text-amber-400 transition-colors line-clamp-1 uppercase tracking-tight">
                        {item.title}
                      </h3>
                      <p className="text-sm text-slate-400 line-clamp-2 mt-2 h-10 leading-snug font-light">
                        {item.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                      </p>

                      <div className="mt-auto pt-4 bg-amber-500/5 p-3 rounded-2xl border border-amber-500/10 group-hover:bg-amber-500/10 transition-colors">
                        <p className="text-[10px] uppercase text-amber-600 font-black mb-1 tracking-widest">Wishlist</p>
                        <p className="text-sm text-amber-200 font-medium line-clamp-1 italic">
                          "{item.wishlist || "อะไรก็ได้"}"
                        </p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-full text-center py-20 bg-slate-900/20 rounded-[40px] border border-dashed border-white/5 text-slate-500 italic">
                {searchTerm || selectedCategory !== "ทั้งหมด" ? "ไม่พบรายการที่ตรงกับการค้นหา" : "ยังไม่มีรายการประกาศในขณะนี้"}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
// คอมเม้นอธิบายการทำงาน:
// 1. fetchItems: ทำหน้าที่ไป "เคาะประตู" ถาม API ว่าใน DB มีของอะไรบ้าง แล้วเอามาใส่ในตะกร้า (items)
// 2. items.map: คือการเอาตะกร้าสินค้ามาเรียงกางออกทีละชิ้น (Card) ถ้าใน DB มี 10 ชิ้น มันก็จะสร้าง 10 Card
// 3. line-clamp-1 / line-clamp-2: ใช้เพื่อจำกัดบรรทัดข้อความไม่ให้ยาวจนล้น Card
// 4. {!session ? ...}: ถ้ายังไม่ login ปุ่ม "ลงประกาศ" จะหายไป เพื่อป้องกัน Error ตอนส่งข้อมูล