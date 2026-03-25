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

  const [previews, setPreviews] = useState([]);
  const [isFree, setIsFree] = useState(false);
  const [loading, setLoading] = useState(false); // ✅ เพิ่ม loading state กันกดเบิ้ล

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: categories[0],
    wishlist: "",
    images_data: []
  });

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const maxFiles = 8;
    if (files.length > maxFiles) {
      alert(`เลือกรูปได้สูงสุด ${maxFiles} รูป`);
      return;
    }

    const tooLarge = files.find((file) => file.size > 5 * 1024 * 1024);
    if (tooLarge) {
      alert("มีรูปภาพขนาดใหญ่เกินไป (จำกัดรูปละ 5MB)");
      return;
    }

    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(file);
          })
      )
    ).then((results) => {
      const images = results.filter((v) => typeof v === "string");
      setPreviews(images);
      setFormData((prev) => ({ ...prev, images_data: images }));
    });
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
          image_data: formData.images_data?.[0] || "",
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
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto h-20 flex items-center justify-between">
          <a href="/" className="text-xl font-bold text-gold-gradient">
            BUU Exchange
          </a>
          <div className="flex items-center gap-3">
            <a href="/" className="text-slate-400 hover:text-white transition-colors">
              ← กลับหน้าหลัก
            </a>
          </div>
        </div>
      </nav>
      <div className="max-w-2xl mx-auto glass-card p-8 rounded-[40px] border border-white/5 mt-10">
        <h1 className="text-3xl font-black text-amber-500 mb-6 text-center tracking-tighter uppercase">ลงประกาศใหม่</h1>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 1. อัปโหลดรูปภาพ */}
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-3xl p-6 bg-slate-900/50 hover:border-amber-500/50 transition-all group">
            {previews.length > 0 ? (
              <div className="w-full">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {previews.map((src, idx) => (
                    <div key={`preview-${idx}`} className="relative">
                      <img src={src} className="h-36 w-full rounded-2xl shadow-2xl object-cover" alt={`Preview ${idx + 1}`} />
                      {idx === 0 && (
                        <span className="absolute top-2 left-2 text-[10px] font-black px-2 py-1 rounded-full bg-amber-500 text-slate-950">
                          รูปหลัก
                        </span>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPreviews([]);
                    setFormData((prev) => ({ ...prev, images_data: [] }));
                  }}
                  className="mt-3 text-xs font-black uppercase tracking-widest text-red-300 hover:text-red-200"
                >
                  ล้างรูปทั้งหมด
                </button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-slate-500 text-3xl mb-2">📸</div>
                <div className="text-slate-400 text-sm mb-4">เลือกรูปสินค้าได้หลายรูป (สูงสุด 8 รูป)</div>
              </div>
            )}
            <input 
              type="file" 
              accept="image/*" 
              multiple
              required={previews.length === 0}
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