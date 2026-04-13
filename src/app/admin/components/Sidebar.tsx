"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "ダッシュボード", icon: "📊" },
  { href: "/admin/users", label: "ユーザー", icon: "👤" },
  { href: "/admin/chats", label: "チャットログ", icon: "💬" },
  { href: "/admin/symptoms", label: "症状統計", icon: "📈" },
  { href: "/admin/posture", label: "姿勢記録", icon: "🧍" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 min-h-screen p-4 flex flex-col gap-1 shrink-0">
      <div className="px-3 py-4 mb-4">
        <h1 className="text-xl font-bold text-white">ZERO-PAIN</h1>
        <p className="text-xs text-gray-500">Admin Dashboard</p>
      </div>
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              active
                ? "bg-blue-600/20 text-blue-400 font-medium"
                : "text-gray-400 hover:bg-gray-800 hover:text-white"
            }`}
          >
            <span>{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
    </aside>
  );
}
