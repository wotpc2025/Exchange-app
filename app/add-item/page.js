"use client";
import { useEffect, useState } from "react";
import { categories } from "@/lib/categories";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { emitDataChanged } from "@/lib/refresh-bus";

export default function AddItemPage() {
  const { data: session } = useSession();
  const router = useRouter();

  // ป้องกันให้ admin เข้าเมนูลงประกาศไม่ได้
  useEffect(() => {
    if (session && session.user?.role === "admin") {
      // ถ้าเป็น admin ให้กลับไปหน้าแรก
      router.replace("/");
    }
  }, [session]);

  const [isPreview, setIsPreview] = useState(null);
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(false); // ✅ เพิ่ม loading state กันกดเบิ้ล

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: categories[0],
    wishlist: "",
    image_data: ""
  });

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // ✅ เช็คขนาดรูป (ไม่ควรเกิน 5MB)
        alert("รูปภาพขนาดใหญ่เกินไปครับ (จำกัด 5MB)");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setIsPreview(reader.result);
        setFormData({ ...formData, image_data: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!session) {
      alert("กรุณาเข้าสู่ระบบก่อนครับ");
      return;
    }

    setLoading(true); // ✅ เริ่มโหลด

    try {
      const response = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          owner_email: session.user.email
        }),
      });

      // ✅ ตรวจสอบสถานะ response อย่างละเอียด
      if (response.ok) {
        alert("ลงประกาศสำเร็จแล้ว!");
        emitDataChanged({ source: "add-item", action: "created" });
        router.push("/");
        router.refresh(); // ✅ Refresh ข้อมูลหน้าหลักให้เป็นปัจจุบัน
      } else {
        // 🛠 แก้ไขจุดที่เกิด Error: เช็คว่ามี body ส่งกลับมาไหมก่อนแกะ JSON
        let errorMessage = "เกิดข้อผิดพลาดในการบันทึก";
        const contentType = response.headers.get("content-type");
        
        if (contentType && contentType.includes("application/json")) {
          const err = await response.json();
          errorMessage = err.message || err.error || errorMessage;
        }

        alert("ผิดพลาด: " + errorMessage);
      }
    } catch (error) {
      console.error(error);
      alert("เชื่อมต่อ Server ไม่ได้ หรือฐานข้อมูลมีปัญหา");
    } finally {
      setLoading(false); // ✅ ปิดโหลด
    }
  };

  return (
    <div className="min-h-screen py-10 px-4 bg-[#020617]">
      <div className="max-w-2xl mx-auto glass-card p-8 rounded-[40px] border border-white/5">
        <h1 className="text-3xl font-black text-amber-500 mb-6 text-center tracking-tighter uppercase">ลงประกาศใหม่</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. อัปโหลดรูปภาพ */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl p-6 bg-slate-900/50 hover:border-amber-500/50 transition-all group">
            {isPreview ? (
              <div className="relative w-full flex justify-center">
                 <img src={isPreview} className="max-h-60 rounded-2xl shadow-2xl object-cover" alt="Preview" />
                 <button 
                  type="button"
                  onClick={() => {setIsPreview(null); setFormData({...formData, image_data: ""})}}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full font-bold shadow-lg"
                 >✕</button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-slate-500 text-3xl mb-2">📸</div>
                <div className="text-slate-400 text-sm mb-4">คลิกเพื่อเลือกรูปภาพสินค้า</div>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              required={!isPreview}
              onChange={handleFileChange} 
              className="text-xs text-slate-400 file:bg-amber-500 file:rounded-full file:border-0 file:px-4 file:py-2 file:font-bold cursor-pointer opacity-70 hover:opacity-100"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="text-amber-500 text-[10px] font-black uppercase ml-2 tracking-widest">ชื่อสิ่งของ</label>
              <input 
                type="text" 
                required
                value={formData.title}
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500 mt-1 text-white" 
                placeholder="เช่น หนังสือแคลคูลัส"
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>
            <div>
              <label className="text-amber-500 text-[10px] font-black uppercase ml-2 tracking-widest">หมวดหมู่</label>
              <select 
                className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500 mt-1 appearance-none text-white"
                value={formData.category}
                onChange={(e) => setFormData({...formData, category: e.target.value})}
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-amber-500 text-[10px] font-black uppercase ml-2 tracking-widest">รายละเอียด / สภาพของ</label>
            <textarea 
              rows="3"
              required
              value={formData.description}
              className="w-full bg-slate-950/50 border border-white/10 rounded-2xl py-3 px-4 outline-none focus:border-amber-500 mt-1 text-white" 
              placeholder="เช่น สภาพ 90% มีรอยขีดข่วนเล็กน้อย..."
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            ></textarea>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1 px-2">
              <label className="text-amber-500 text-[10px] font-black uppercase tracking-widest">สิ่งที่ต้องการแลกคืน</label>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={isFree}
                  onChange={() => {
                    const newFree = !isFree;
                    setIsFree(newFree);
                    setFormData({...formData, wishlist: newFree ? "ให้ฟรี (FREE)" : ""});
                  }}
                  className="accent-amber-500 w-4 h-4"
                />
                <span className="text-xs text-slate-300 group-hover:text-amber-400">ส่งต่อให้เพื่อนนิสิตฟรี</span>
              </label>
            </div>
            <input 
              type="text" 
              disabled={isFree}
              required
              value={formData.wishlist}
              onChange={(e) => setFormData({...formData, wishlist: e.target.value})}
              className={`w-full border rounded-2xl py-3 px-4 outline-none transition-all ${isFree ? 'bg-amber-500/10 border-amber-500/50 text-amber-500 font-bold' : 'bg-slate-950/50 border-white/10 text-white'}`}
              placeholder="ระบุของที่อยากได้ หรือ 'อะไรก็ได้'"
            />
          </div>

          <button 
            type="submit"
            disabled={loading}
            className="gold-glow w-full bg-amber-500 text-slate-950 font-black py-4 rounded-2xl text-lg uppercase tracking-tighter mt-4 hover:bg-amber-400 transition-all disabled:opacity-50"
          >
            {loading ? "กำลังบันทึกข้อมูล..." : "🚀 ลงประกาศแลกเปลี่ยน"}
          </button>
        </form>
      </div>
    </div>
  );
}