// lib/db.js
import mysql from 'mysql2/promise';

// สร้าง connection pool เพื่อประสิทธิภาพที่ดี (ไม่ต้องต่อใหม่ทุกครั้งที่เรียก)
export const db = mysql.createPool({
    host: process.env.DB_HOST,      // IP: 10.104.7.169 (เปลี่ยนใน .env)
    user: process.env.DB_USER,      // root (เปลี่ยนใน .env)
    password: process.env.DB_PASSWORD, // MQHypg13973 (เปลี่ยนใน .env)
    database: process.env.DB_NAME, // Exchange (เปลี่ยนใน .env)
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 1. ถ้าต้องการเปลี่ยน Database ให้ไปเปลี่ยนที่ไฟล์ .env
// 2. การใช้ createPool จะช่วยให้ระบบไม่ค้างเวลาคนใช้งานเยอะๆ