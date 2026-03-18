"use client";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* วงแสงพื้นหลัง (Ambient Light) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px]"></div>

      <div className="glass-card max-w-md w-full p-12 rounded-[40px] relative z-10 text-center">
        <h1 className="text-4xl font-extrabold text-gold-gradient mb-2">BUU Exchange</h1>
        <p className="text-slate-400 text-sm tracking-widest uppercase mb-10">Student Exchange</p>

        <button
          onClick={() => signIn("google", { callbackUrl: "/" })}
          className="gold-glow w-full flex items-center justify-center gap-4 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 py-4 px-6 rounded-full font-bold text-lg"
        >
          <img src="https://th.bing.com/th/id/OIP.1OmqVMG57-1hNj3csJQGnAHaHa?w=173&h=180&c=7&r=0&o=7&pid=1.7&rm=3" className="w-5 h-5" alt="Google" />
          <span>เข้าสู่ระบบด้วย @go.buu.ac.th</span>
        </button>
      </div>
    </div>
  );
}

// คอมเม้น:
// 1. signIn("google", { callbackUrl: "/" }) คือเมื่อ login ผ่าน จะเด้งไปหน้าแรก (/)
// 2. ถ้าอยากเปลี่ยนสีปุ่ม ให้เปลี่ยนตรง 'bg-white' หรือ 'text-blue-600' เป็นสีที่ชอบ