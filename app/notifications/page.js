
import { Suspense } from "react";
import NotificationsClient from "./NotificationsClient";

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#020617] text-white flex items-center justify-center">กำลังโหลด...</div>}>
      <NotificationsClient />
    </Suspense>
  );
}
