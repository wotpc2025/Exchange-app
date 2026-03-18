// app/api/auth/[...nextauth]/route.js
import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "../../../../lib/db.js";

export const authOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  callbacks: {
    async signIn({ profile }) {
      // ตรวจสอบว่าต้องเป็น @go.buu.ac.th เท่านั้น
      if (!profile.email.endsWith("@go.buu.ac.th")) {
        return false;
      }

      try {
        const [rows] = await db.execute(
          "SELECT id, role, name, image FROM users WHERE email = ?",
          [profile.email]
        );

        let userId;
        if (rows.length === 0) {
          const [created] = await db.execute(
            "INSERT INTO users (email, name, image) VALUES (?, ?, ?)",
            [profile.email, profile.name, profile.picture]
          );
          userId = created.insertId;
        } else {
          userId = rows[0].id;

          // อัปเดตชื่อและรูปโปรไฟล์จาก Google ทุกครั้งที่ล็อกอิน
          // เพื่อให้หน้าต่าง ๆ ที่ใช้ข้อมูลจาก DB ได้รูปล่าสุดเสมอ
          await db.execute(
            "UPDATE users SET name = ?, image = ? WHERE id = ?",
            [profile.name, profile.picture, userId]
          );
        }

        // 🔒 บล็อกการเข้าสู่ระบบ ถ้ายังโดนแบนอยู่
        const [bans] = await db.execute(
          `SELECT * FROM user_bans
           WHERE user_id = ? AND active = 1
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [userId]
        );

        if (bans.length > 0) {
          const ban = bans[0];
          const stillBanned =
            ban.ban_type === "permanent" ||
            (ban.end_at && new Date(ban.end_at).getTime() > Date.now());

          if (stillBanned) return false;

          // หมดอายุแล้ว -> ปลด active อัตโนมัติ
          await db.execute("UPDATE user_bans SET active = 0 WHERE id = ?", [
            ban.id,
          ]);
        }

        return true;
      } catch (error) {
        console.error("DB Error:", error);
        return false;
      }
    },

    async jwt({ token }) {
      if (!token.email) return token;

      try {
        const [rows] = await db.execute(
          "SELECT id, role FROM users WHERE email = ?",
          [token.email]
        );

        if (rows.length > 0) {
          token.userId = rows[0].id;
          token.role = rows[0].role || "student";
        }
      } catch (error) {
        console.error("JWT callback error:", error);
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId;
        session.user.role = token.role || "student";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };

// คอมเม้น:
// 1. profile.email.endsWith("@go.buu.ac.th") คือจุดสำคัญที่บล็อกคนนอก
// 2. db.execute คือการสั่งรันคำสั่ง SQL ลงไปใน MySQL ของคุณ