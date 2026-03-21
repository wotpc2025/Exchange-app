"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { emitDataChanged } from "@/lib/refresh-bus";
import Link from "next/link";

export default function EditItem({ params }) {
  const pathname = usePathname();
  // ใช้ params.id ถ้ามี (Next.js 13+), fallback เป็น path
  const id = params?.id || pathname?.split("/").filter(Boolean).at(-2);
  const router = useRouter();

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    category: "ของใช้ทั่วไป",
    wishlist: "",
    image_url: ""
  });

  // 1. ดึงข้อมูลเดิมมาโชว์ก่อน
  useEffect(() => {
    if (!id) return;
    fetch(`/api/items/${id}`)
      .then(async res => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          console.error('Fetch error:', res.status, err);
          alert('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + (err.message || res.status));
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        setFormData({
          title: data.title ?? "",
          description: data.description ?? "",
          category: data.category ?? "ของใช้ทั่วไป",
          wishlist: data.wishlist ?? "",
          image_url: data.image_url ?? ""
        });
      })
      .catch(err => {
        console.error('Unexpected error:', err);
        alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
      });
  }, [id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch(`/api/items/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    if (res.ok) {
      alert("แก้ไขข้อมูลเรียบร้อย!");
      emitDataChanged({ source: "edit-item", action: "updated", itemId: id });
      router.push(`/items/${id}`); // แก้เสร็จแล้วพากลับไปดูหน้ารายละเอียด
    }
  };

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
        <div className="max-w-2xl mx-auto glass-card p-8 rounded-[40px] border border-white/5 mt-10">
          <h1 className="text-3xl font-black mb-8 text-amber-500">แก้ไขประกาศของคุณ</h1>
          {/* รูปภาพ */}
          <div className="flex flex-col items-center justify-center mb-8">
            {formData.image_url ? (
              <div className="relative w-full flex justify-center mb-2">
                <img src={formData.image_url} className="max-h-60 rounded-2xl shadow-2xl object-cover" alt="Preview" />
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, image_url: "" })}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-8 h-8 rounded-full font-bold shadow-lg"
                >✕</button>
              </div>
            ) : (
              <div className="text-center">
                <div className="text-slate-500 text-3xl mb-2">📸</div>
                <div className="text-slate-400 text-sm mb-4">คลิกเพื่อเลือกรูปภาพสินค้าใหม่</div>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={e => {
                const file = e.target.files[0];
                if (file) {
                  if (file.size > 5 * 1024 * 1024) {
                    alert("รูปภาพขนาดใหญ่เกินไปครับ (จำกัด 5MB)");
                    return;
                  }
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    setFormData({ ...formData, image_url: reader.result });
                  };
                  reader.readAsDataURL(file);
                }
              }}
              className="text-xs text-slate-400 file:bg-amber-500 file:rounded-full file:border-0 file:px-4 file:py-2 file:font-bold cursor-pointer opacity-70 hover:opacity-100"
            />
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">ชื่อสิ่งของ</label>
            <input 
              type="text" 
              className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white focus:border-amber-500 outline-none"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">รายละเอียด (สภาพ/ตำหนิ)</label>
            <textarea 
              className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white h-32 outline-none"
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">อยากแลกกับอะไร?</label>
            <input 
              type="text" 
              className="w-full bg-slate-900 border border-white/10 rounded-2xl p-4 text-white outline-none opacity-70 cursor-not-allowed"
              value={formData.wishlist}
              readOnly
              disabled
              placeholder="เช่น ขนม, ปากกา, หรืออะไรก็ได้"
            />
          </div>

          <button type="submit" className="gold-glow bg-amber-500 text-slate-950 font-black py-4 rounded-2xl text-lg hover:bg-amber-400 transition-all">
            บันทึกการแก้ไข
          </button>
        </form>
      </div>
    </div>
  );
}