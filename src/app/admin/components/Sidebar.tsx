"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "ダッシュボード", icon: "📊", color: "from-blue-500 to-cyan-400" },
  { href: "/admin/users", label: "ユーザー", icon: "👤", color: "from-violet-500 to-purple-400" },
  { href: "/admin/chats", label: "チャットログ", icon: "💬", color: "from-pink-500 to-rose-400" },
  { href: "/admin/symptoms", label: "症状統計", icon: "📈", color: "from-amber-500 to-yellow-400" },
  { href: "/admin/posture", label: "姿勢記録", icon: "🧍", color: "from-emerald-500 to-green-400" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 bg-gradient-to-b from-gray-900 to-gray-950 border-r border-gray-800 min-h-screen p-5 flex flex-col gap-1 shrink-0">
      <div className="px-3 py-4 mb-6">
        <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
          ZERO-PAIN
        </h1>
        <p className="text-xs text-gray-500 mt-1 tracking-wider">ADMIN DASHBOARD</p>
      </div>
      {links.map((l) => {
        const active = pathname === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
              active
                ? `bg-gradient-to-r ${l.color} text-white font-bold shadow-lg shadow-blue-500/10`
                : "text-gray-400 hover:bg-gray-800/60 hover:text-white"
            }`}
          >
            <span className="text-lg">{l.icon}</span>
            {l.label}
          </Link>
        );
      })}
      <div className="mt-auto pt-4 border-t border-gray-800">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm text-gray-500 hover:bg-gray-800/60 hover:text-white transition-all"
        >
          <span className="text-lg">🏠</span>
          アプリに戻る
        </Link>
      </div>
    </aside>
  );
}
