import Link from "next/link";

export default function RulesButton() {
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <Link href="/rules">
        <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-full shadow-lg font-bold text-base transition-all">
          อ่านกฎการแลกเปลี่ยน
        </button>
      </Link>
    </div>
  );
}
