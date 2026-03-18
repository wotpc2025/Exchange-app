"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";

export default function PublicUserProfilePage() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const userId = pathname?.split("/").filter(Boolean).pop();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    if (status === "loading") return;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "ไม่สามารถโหลดโปรไฟล์ได้");
        }
        setProfile(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [userId, status]);

  const exchangedItems = useMemo(
    () => (profile?.items || []).filter((i) => i.status === "exchanged"),
    [profile]
  );

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">
        กำลังโหลดโปรไฟล์...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-[#020617] text-white flex flex-col items-center justify-center gap-4">
        <p>{error || "ไม่พบโปรไฟล์ผู้ใช้นี้"}</p>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 rounded-2xl border border-white/20 text-xs uppercase tracking-widest text-slate-300 hover:bg-white/5"
        >
          ← กลับ
        </button>
      </div>
    );
  }

  const { user, stats } = profile;
  const isAdmin = user.role === "admin";
  const isOnline = status === "authenticated" && String(session?.user?.id) === String(user.id);

  const baseImage =
    (typeof user.image === "string" && user.image.trim() !== ""
      ? user.image
      : null) || null;
  const fallbackImage =
    "https://ui-avatars.com/api/?background=0f172a&color=fbbf24&name=" +
    encodeURIComponent(user.name || user.email || "User");
  const avatarImage = baseImage || fallbackImage;

  const onlineBadge = (
    <span
      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
        isOnline
          ? "bg-emerald-500/10 text-emerald-300 border-emerald-400/50"
          : "bg-slate-700/60 text-slate-300 border-slate-500/60"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${
          isOnline ? "bg-emerald-400 animate-pulse" : "bg-slate-500"
        }`}
      />
      {isOnline ? "ออนไลน์" : "ออฟไลน์"}
    </span>
  );

  const content = isAdmin ? (
    <AdminView user={user} stats={stats} avatarImage={avatarImage} fallbackImage={fallbackImage} onlineBadge={onlineBadge} />
  ) : (
    <StudentView user={user} stats={stats} avatarImage={avatarImage} fallbackImage={fallbackImage} onlineBadge={onlineBadge} exchangedItems={exchangedItems} />
  );

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <nav className="glass-card sticky top-0 z-50 border-x-0 border-t-0 rounded-none px-6 bg-slate-950/50 backdrop-blur-md">
        <div className="mx-auto h-20 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold text-gold-gradient">
            BUU Exchange
          </Link>
          <button
            onClick={() => router.back()}
            className="text-slate-400 hover:text-white transition-colors text-xs"
          >
            ← กลับ
          </button>
        </div>
      </nav>

      <main className="px-6 py-12">{content}</main>
    </div>
  );
}

function AdminView({ user, stats, avatarImage, fallbackImage, onlineBadge }) {
  const adminSince = user.adminSince ? new Date(user.adminSince) : null;
  const now = new Date();
  let adminDurationText = "-";
  if (adminSince) {
    const diffMs = now.getTime() - adminSince.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) {
      adminDurationText = "น้อยกว่า 1 วัน";
    } else if (diffDays < 30) {
      adminDurationText = `${diffDays} วัน`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      adminDurationText = `${months} เดือน`;
    } else {
      const years = Math.floor(diffDays / 365);
      adminDurationText = `${years} ปีขึ้นไป`;
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass-card p-8 rounded-[40px] border border-white/5 flex flex-col md:flex-row gap-8 mb-10 bg-slate-950/70">
        <div className="flex flex-col items-center md:items-start md:w-1/3">
          <div className="mb-4">
            <img
              src={avatarImage}
              className="w-24 h-24 rounded-full border-2 border-amber-500 object-cover"
              alt={user.name}
              onError={(e) => {
                if (e.currentTarget.src !== fallbackImage) {
                  e.currentTarget.src = fallbackImage;
                }
              }}
            />
          </div>
          <h1 className="text-2xl font-black">{user.name}</h1>
          <p className="text-xs text-slate-400 mt-1">{user.email}</p>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            {onlineBadge}
            <span className="text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/40 text-amber-300 uppercase tracking-widest">
              ADMIN
            </span>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-300 w-full">
            <div>
              <span className="text-slate-500 text-[11px] uppercase tracking-widest">
                ช่องทางติดต่อส่วนกลาง
              </span>
              <p className="mt-1">
                {user.contactInfo && user.contactInfo.trim() !== ""
                  ? user.contactInfo
                  : user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="md:w-2/3 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center glass-card p-5 rounded-2xl border border-white/5 bg-slate-900/60 flex flex-col justify-center min-h-[108px]">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2 min-h-[32px] flex items-center justify-center leading-tight line-clamp-2">
                เคสที่ช่วยประสานงานสำเร็จ
              </p>
              <p className="text-3xl md:text-4xl font-black text-amber-400 leading-none">
                {user.adminSuccessCases ?? 0}
              </p>
            </div>
            <div className="text-center glass-card p-5 rounded-2xl border border-white/5 bg-slate-900/60 flex flex-col justify-center min-h-[108px]">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2 min-h-[32px] flex items-center justify-center leading-tight line-clamp-2">
                ไลก์ที่ได้รับ
              </p>
              <p className="text-3xl md:text-4xl font-black text-pink-400 leading-none">
                {user.adminLikesReceived ?? 0}
              </p>
            </div>
            <div className="text-center glass-card p-5 rounded-2xl border border-white/5 bg-slate-900/60 flex flex-col justify-center min-h-[108px]">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2">
                ระยะเวลาที่เป็นแอดมิน
              </p>
              <p className="text-xl md:text-2xl font-black text-slate-100 leading-tight">
                {adminDurationText}
              </p>
            </div>
            <div className="hidden md:flex text-center glass-card p-5 rounded-2xl border border-white/5 bg-slate-900/60 flex-col justify-center min-h-[108px]">
              <p className="text-[11px] text-slate-400 uppercase tracking-widest mb-2">
                บทบาท
              </p>
              <p className="text-xl md:text-2xl font-black text-amber-300 leading-tight">
                ผู้ดูแลระบบ
              </p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                สรุปการทำงาน
              </p>
              <p className="text-sm text-slate-300">
                สถิติการประสานงานและการดูแลระบบของแอดมินในระบบ BUU
                Exchange
              </p>
            </div>
            <div className="text-sm text-slate-400 whitespace-nowrap flex items-center justify-end gap-1.5">
              <span>รวมเคสที่เกี่ยวข้อง:</span>
              <span className="text-amber-300 font-semibold">
                {user.adminSuccessCases ?? 0} เคส
              </span>
              <span className="text-slate-600">·</span>
              <span className="text-pink-300 font-semibold">
                {user.adminLikesReceived ?? 0} ไลก์
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StudentView({
  user,
  stats,
  avatarImage,
  fallbackImage,
  onlineBadge,
  exchangedItems,
}) {
  const trustScore = user.trustScore ?? 0;
  const hearts = Array.from({ length: Math.min(trustScore, 5) });

  return (
    <div className="max-w-5xl mx-auto">
      <div className="glass-card p-8 rounded-[40px] border border-white/5 flex flex-col md:flex-row gap-8 mb-10 bg-slate-950/70">
        <div className="flex flex-col items-center md:items-start md:w-1/3">
          <img
            src={avatarImage}
            className="w-24 h-24 rounded-full border-2 border-amber-500 mb-4 object-cover"
            alt={user.name}
            onError={(e) => {
              if (e.currentTarget.src !== fallbackImage) {
                e.currentTarget.src = fallbackImage;
              }
            }}
          />
          <h1 className="text-2xl font-black">{user.name}</h1>
          <p className="text-xs text-slate-400 mt-1">{user.email}</p>

          <div className="mt-4 flex flex-wrap gap-2 items-center">
            {onlineBadge}
            <span className="text-[10px] font-black px-3 py-1 rounded-full border border-amber-500/40 text-amber-300 uppercase tracking-widest">
              Student
            </span>
          </div>

          <div className="mt-6 space-y-3 text-sm text-slate-300 w-full">
            <div>
              <span className="text-slate-500 text-[11px] uppercase tracking-widest">
                คณะ
              </span>
              <p className="mt-1">{user.faculty || "-"}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] uppercase tracking-widest">
                สาขา
              </span>
              <p className="mt-1">{user.major || "-"}</p>
            </div>
            <div>
              <span className="text-slate-500 text-[11px] uppercase tracking-widest">
                ช่องทางติดต่อ
              </span>
              <p className="mt-1">
                {user.contactInfo && user.contactInfo.trim() !== ""
                  ? user.contactInfo
                  : user.email}
              </p>
            </div>
          </div>
        </div>

        <div className="md:w-2/3 space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/60">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                พร้อมแลก
              </p>
              <p className="text-2xl font-black text-amber-500">
                {stats?.items?.available ?? 0}
              </p>
            </div>
            <div className="text-center glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/60">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                รอการแลก
              </p>
              <p className="text-2xl font-black text-blue-400">
                {stats?.items?.pending ?? 0}
              </p>
            </div>
            <div className="text-center glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/60">
              <p className="text-[10px] text-slate-400 uppercase tracking-widest mb-1">
                สำเร็จแล้ว
              </p>
              <p className="text-2xl font-black text-green-500">
                {stats?.items?.exchanged ?? 0}
              </p>
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/70 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                คะแนนความน่าเชื่อถือ
              </p>
              <p className="text-sm text-slate-300">
                จากการกดใจเมื่อแลกเปลี่ยนสำเร็จ
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex text-lg">
                {hearts.length > 0
                  ? hearts.map((_, idx) => (
                      <span key={idx} className="text-amber-400">
                        ♥
                      </span>
                    ))
                  : "—"}
              </div>
              <span className="text-xs text-slate-400">
                ({trustScore} คะแนน)
              </span>
            </div>
          </div>

          <div className="glass-card p-4 rounded-2xl border border-white/5 bg-slate-900/70 flex flex-col md:flex-row items-center md:items-start md:justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-slate-400">
                ประวัติใบเหลือง / ใบแดง
              </p>
              <p className="text-sm text-slate-300">
                สถิติวินัยจากทีมแอดมิน
              </p>
            </div>
            <div className="flex gap-3">
              <span className="text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest bg-yellow-500/10 text-yellow-300 border-yellow-500/30">
                ใบเหลือง: {stats?.warnings?.yellow ?? 0}
              </span>
              <span className="text-[10px] font-black px-3 py-1.5 rounded-full border uppercase tracking-widest bg-red-500/10 text-red-300 border-red-500/30">
                ใบแดง: {stats?.warnings?.red ?? 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-bold mb-4">ประวัติการแลกเปลี่ยนสำเร็จ</h2>
      <div className="grid gap-3">
        {exchangedItems.length === 0 ? (
          <div className="glass-card p-6 rounded-2xl border border-white/5 bg-slate-900/60 text-slate-400 text-sm italic">
            ยังไม่มีประวัติการแลกเปลี่ยนสำเร็จ
          </div>
        ) : (
          exchangedItems.map((item) => (
            <div
              key={item.id}
              className="glass-card p-4 rounded-2xl flex items-center gap-4 bg-white/5 border border-white/5"
            >
              {item.image_url && (
                <img
                  src={item.image_url}
                  className="w-12 h-12 rounded-lg object-cover grayscale"
                  alt={item.title}
                />
              )}
              <div>
                <p className="font-medium text-slate-300">{item.title}</p>
                <p className="text-[10px] text-green-500 font-bold uppercase tracking-tighter italic">
                  แลกเปลี่ยนสำเร็จ
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

