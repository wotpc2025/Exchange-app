"use client";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RequestsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (session?.user?.email) {
      // ดึงข้อมูลคำขอแลกเปลี่ยนที่มีอีเมลเราเข้าไปเกี่ยวข้อง
      fetch(`/api/requests?user=${session.user.email}`)
        .then(res => res.json())
        .then(data => {
          setRequests(Array.isArray(data) ? data : []);
          setLoading(false);
        });
    }
  }, [session]);

  if (loading) return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-white">กำลังโหลดรายการแชท...</div>;

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
                กล่องแชทและคำขอแลกเปลี่ยน
              </h1>
              <p className="text-sm text-slate-400 mt-1">
                ดูประวัติการแชทและคำขอแลกเปลี่ยนทั้งหมดที่เกี่ยวข้องกับคุณ
              </p>
            </div>
          </div>
        <div className="grid gap-4">
          {requests.length > 0 ? (
            requests.map((req) => (
              <div
                key={req.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/chat/${req.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/chat/${req.id}`);
                  }
                }}
                className="glass-card p-5 rounded-[30px] border border-white/5 hover:border-amber-500/50 transition-all flex items-center justify-between group cursor-pointer"
              >
                  <div className="flex items-center gap-5">
                    {/* รูปสินค้า */}
                    <div className="relative">
                      <img src={req.item_image} className="w-16 h-16 rounded-2xl object-cover border border-white/10" alt="" />
                      <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-[#020617] flex items-center justify-center text-[10px] ${
                        req.owner_email === session.user.email ? 'bg-blue-500' : 'bg-amber-500'
                      }`}>
                        {req.owner_email === session.user.email ? '📩' : '📤'}
                      </div>
                    </div>

                    <div>
                      <h3 className="font-bold text-lg group-hover:text-amber-400 transition-colors line-clamp-1">{req.item_title}</h3>
                      <p className="text-xs text-slate-500">
                        {req.owner_email === session.user.email ? (
                          <>
                            จาก:{" "}
                            {req.requester_id ? (
                              <Link
                                href={`/users/${req.requester_id}`}
                                className="underline-offset-2 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {req.requester_name || req.requester_email}
                              </Link>
                            ) : (
                              req.requester_name || req.requester_email
                            )}
                          </>
                        ) : (
                          <>
                            ทักหาเจ้าของ:{" "}
                            {req.owner_id ? (
                              <Link
                                href={`/users/${req.owner_id}`}
                                className="underline-offset-2 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {req.owner_name || req.owner_email}
                              </Link>
                            ) : (
                              req.owner_name || req.owner_email
                            )}
                          </>
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                      req.status === 'pending' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 
                      req.status === 'accepted' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 
                      'bg-red-500/10 text-red-400 border border-red-500/20'
                    }`}>
                      {req.status}
                    </span>
                    <p className="text-[9px] text-slate-600 mt-2 uppercase">
                      {new Date(req.created_at).toLocaleDateString()}
                    </p>
                  </div>
              </div>
                    ))
                    ) : (
                  <div className="text-center py-20 bg-slate-900/50 rounded-[40px] border border-dashed border-white/10">
                    <p className="text-slate-500 italic">ยังไม่มีประวัติการแชทหรือคำขอแลกเปลี่ยน</p>
                  </div>
                )}
              </div>
            </div>
        </div>
      </div>
  );
}