"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Theater as IconTheater,
  MessagesSquare as IconMessages,
  Palette as IconPalette,
  MessageCircle as IconMessageCircle,
  FileText as IconFileText,
  Database as IconDatabase,
  Sun as IconSun,
  Moon as IconMoon,
  Settings as IconSettingsCog,
  Languages as IconLanguages,
  Skull as IconSkull,
  Trash2 as IconTrash,
  ChevronRight as IconChevronRight,
  Smartphone as IconSmartphone,
  Copy as IconCopy,
  KeyRound as IconKeyRound,
} from "lucide-react";
import { CHARACTERS, type SenseiCharacterId } from "../lib/sensei-characters";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("zero_pain_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("zero_pain_device_id", id);
  }
  return id;
}

type ThemeMode = "light" | "dark" | "system";
type DialectPref = "standard" | "kansai";

export default function SettingsPage() {
  const [userName, setUserName] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("light");
  const [dialect, setDialect] = useState<DialectPref>("standard");
  const [character, setCharacter] = useState<SenseiCharacterId>("kentaro");

  // ===== デバイス引継ぎ =====
  const [transferMode, setTransferMode] = useState<null | "generate" | "restore">(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [restoreInput, setRestoreInput] = useState("");

  const handleGenerateCode = async () => {
    setTransferLoading(true);
    setGeneratedCode(null);
    try {
      const res = await fetch("/api/transfer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "コード発行に失敗しました" });
        return;
      }
      setGeneratedCode(data.displayCode);
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setTransferLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!generatedCode) return;
    try {
      await navigator.clipboard.writeText(generatedCode);
      setMessage({ type: "ok", text: "コードをコピーしました" });
    } catch {
      setMessage({ type: "error", text: "コピーに失敗しました" });
    }
  };

  const handleRestore = async () => {
    if (!restoreInput.trim()) return;
    setTransferLoading(true);
    try {
      const res = await fetch("/api/transfer/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: restoreInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "復元に失敗しました" });
        return;
      }
      // 引き継ぎ成功 → 旧 deviceId を上書き
      localStorage.setItem("zero_pain_device_id", data.deviceId);
      setMessage({ type: "ok", text: "引き継ぎが完了しました。アプリを再読み込みします..." });
      setTimeout(() => window.location.href = "/", 1500);
    } catch {
      setMessage({ type: "error", text: "通信エラーが発生しました" });
    } finally {
      setTransferLoading(false);
    }
  };

  // 口調設定の初期化
  useEffect(() => {
    const saved = (localStorage.getItem("zero_pain_dialect") as DialectPref | null) || "standard";
    setDialect(saved === "kansai" ? "kansai" : "standard");
  }, []);

  // キャラクター設定の初期化
  useEffect(() => {
    const saved = localStorage.getItem("zero_pain_character") as SenseiCharacterId | null;
    if (saved && (saved === "kentaro" || saved === "honemi" || saved === "honeta" || saved === "koturi")) {
      setCharacter(saved);
    }
  }, []);

  const applyDialect = (d: DialectPref) => {
    setDialect(d);
    localStorage.setItem("zero_pain_dialect", d);
  };

  const applyCharacter = (c: SenseiCharacterId) => {
    setCharacter(c);
    localStorage.setItem("zero_pain_character", c);
  };

  // テーマ初期化
  useEffect(() => {
    const saved = (localStorage.getItem("zero_pain_theme") as ThemeMode | null) || "light";
    setTheme(saved);
  }, []);

  // テーマ変更時の処理
  const applyTheme = (mode: ThemeMode) => {
    setTheme(mode);
    localStorage.setItem("zero_pain_theme", mode);
    let resolved: "light" | "dark" = "light";
    if (mode === "system") {
      resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } else {
      resolved = mode;
    }
    if (resolved === "light") {
      document.documentElement.classList.add("theme-mint");
    } else {
      document.documentElement.classList.remove("theme-mint");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: getDeviceId() }),
        });
        const data = await res.json();
        if (data.registered && data.user) {
          setUserName(data.user.name || null);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleExport = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/account?action=export&deviceId=${encodeURIComponent(deviceId)}`
      );
      if (!res.ok) throw new Error("エクスポート失敗");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `zero-pain-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setMessage({ type: "ok", text: "✅ データをダウンロードしました" });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "エクスポート失敗",
      });
    } finally {
      setExporting(false);
    }
  };

  const handleDelete = async () => {
    if (deleteText !== "DELETE") {
      setMessage({ type: "error", text: "「DELETE」と入力してください" });
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          confirmText: "DELETE",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "削除失敗");

      // LocalStorage の端末ID もクリア（完全リセット）
      localStorage.removeItem("zero_pain_device_id");
      localStorage.removeItem("zero_pain_reminder_hours");
      localStorage.removeItem("zero_pain_last_active");

      // 完了画面を表示
      setMessage({
        type: "ok",
        text: "✅ アカウントと全データを削除しました。アプリを再起動してください。",
      });
      setShowDeleteModal(false);

      // 3秒後にホームへ
      setTimeout(() => {
        window.location.href = "/";
      }, 3000);
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "削除失敗",
      });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
        >
          ← 戻る
        </Link>
        <h1 className="text-base font-bold flex items-center gap-1.5">
          <IconSettingsCog size={18} className="text-emerald-400" />
          設定
        </h1>
      </header>

      <div className="max-w-md mx-auto px-4 py-5 space-y-5">
        {/* アカウント情報 */}
        <section className="card-base p-4">
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2">
            👤 アカウント
          </p>
          <p className="text-base font-bold text-white">
            {userName ? `${userName} さん` : "未登録"}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            端末ID: {getDeviceId().slice(0, 8)}...
          </p>
        </section>

        {/* テーマ設定 */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconPalette size={14} className="text-emerald-400" />
            表示テーマ
          </p>
          <div className="card-base p-4 space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              アプリの背景色と配色を選べます。お好みやシーン（昼・夜）に合わせて切り替えてください。
            </p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { id: "light", Icon: IconSun, label: "ライト", desc: "ミント", color: "text-amber-400" },
                { id: "dark", Icon: IconMoon, label: "ダーク", desc: "ブラック", color: "text-indigo-300" },
                { id: "system", Icon: IconSettingsCog, label: "自動", desc: "OS連動", color: "text-gray-300" },
              ] as const).map((opt) => {
                const Icon = opt.Icon;
                const isActive = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => applyTheme(opt.id)}
                    className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1.5 transition active:scale-95 ${
                      isActive
                        ? "bg-emerald-500/20 border-emerald-500"
                        : "bg-gray-800 border-gray-700"
                    }`}
                  >
                    <Icon size={26} strokeWidth={2} className={isActive ? "text-emerald-300" : opt.color} />
                    <p className={`text-xs font-bold ${isActive ? "text-emerald-300" : "text-gray-200"}`}>
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-gray-500">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ガイコツ先生のキャラクター選択 */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconTheater size={14} className="text-emerald-400" />
            ガイコツ先生のキャラ
          </p>
          <div className="card-base p-4 space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              4人のキャラクターから、あなたに合うガイコツ先生を選べます。それぞれ性格やアプローチが異なります。
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CHARACTERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => applyCharacter(c.id)}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition active:scale-95 text-center ${
                    character === c.id
                      ? "bg-emerald-500/20 border-emerald-500"
                      : "bg-gray-800 border-gray-700"
                  }`}
                >
                  <span className="text-3xl">{c.emoji}</span>
                  <p className={`text-[11px] font-bold leading-tight ${character === c.id ? "text-emerald-300" : "text-gray-200"}`}>
                    {c.displayName.split("(")[0].trim()}
                  </p>
                  <p className="text-[10px] text-gray-500">{c.shortDesc}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              ※ 設定後、次回のメッセージから新しいキャラで応答します
            </p>
          </div>
        </section>

        {/* ガイコツ先生の口調設定 */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconMessages size={14} className="text-emerald-400" />
            ガイコツ先生の口調
          </p>
          <div className="card-base p-4 space-y-3">
            <p className="text-xs text-gray-400 leading-relaxed">
              ガイコツ先生の話し方を選べます。1週間以上ご利用いただくと、自動的に親しみのあるタメ口に切り替わります。
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { id: "standard", emoji: "🗾", label: "標準語", desc: "丁寧で親しみやすい" },
                { id: "kansai", emoji: "🐯", label: "関西弁", desc: "ノリよく親しみ全開" },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => applyDialect(opt.id)}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition active:scale-95 ${
                    dialect === opt.id
                      ? "bg-emerald-500/20 border-emerald-500"
                      : "bg-gray-800 border-gray-700"
                  }`}
                >
                  <span className="text-2xl">{opt.emoji}</span>
                  <p className={`text-xs font-bold ${dialect === opt.id ? "text-emerald-300" : "text-gray-200"}`}>
                    {opt.label}
                  </p>
                  <p className="text-[10px] text-gray-500">{opt.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-500 leading-relaxed">
              ※ 設定後、次回のメッセージから反映されます
            </p>
          </div>
        </section>

        {/* サポート */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconMessageCircle size={14} className="text-emerald-400" />
            サポート
          </p>
          <Link
            href="/support"
            className="card-accent-emerald flex items-center justify-between p-4 active:scale-[0.99] transition"
          >
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                <IconMessageCircle size={18} className="text-emerald-300" />
              </span>
              <div>
                <p className="text-sm font-bold text-white">FAQ・お問い合わせ</p>
                <p className="text-[11px] text-emerald-200 mt-0.5">ご質問・ご意見はこちらから</p>
              </div>
            </div>
            <IconChevronRight size={18} className="text-emerald-300 flex-shrink-0" />
          </Link>
        </section>

        {/* 法務情報リンク */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconFileText size={14} className="text-emerald-400" />
            規約・ポリシー
          </p>
          <div className="space-y-2">
            <Link
              href="/privacy"
              className="card-base flex items-center justify-between p-4 active:scale-[0.99] transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  <IconFileText size={18} className="text-gray-300" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">プライバシーポリシー</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">データ取扱いについて</p>
                </div>
              </div>
              <IconChevronRight size={18} className="text-gray-500 flex-shrink-0" />
            </Link>

            <Link
              href="/terms"
              className="card-base flex items-center justify-between p-4 active:scale-[0.99] transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  <IconFileText size={18} className="text-gray-300" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">利用規約</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">本アプリの利用条件</p>
                </div>
              </div>
              <IconChevronRight size={18} className="text-gray-500 flex-shrink-0" />
            </Link>
          </div>
        </section>

        {/* デバイス引継ぎ */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconSmartphone size={14} className="text-blue-400" />
            デバイス引継ぎ（機種変更）
          </p>
          <div className="space-y-2">
            <button
              onClick={() => { setTransferMode("generate"); setGeneratedCode(null); }}
              className="card-base w-full flex items-center justify-between p-4 active:scale-[0.99] transition text-left"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <IconKeyRound size={18} className="text-blue-400" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">引継ぎコードを発行</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">新しい端末で入力してデータを移行</p>
                </div>
              </div>
              <IconChevronRight size={18} className="text-gray-500 flex-shrink-0" />
            </button>

            <button
              onClick={() => { setTransferMode("restore"); setRestoreInput(""); }}
              className="card-base w-full flex items-center justify-between p-4 active:scale-[0.99] transition text-left"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <IconCopy size={18} className="text-purple-400" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">コードを入力して復元</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">前の端末で発行したコードでデータを復元</p>
                </div>
              </div>
              <IconChevronRight size={18} className="text-gray-500 flex-shrink-0" />
            </button>
          </div>
        </section>

        {/* データ管理 */}
        <section>
          <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2 px-1 flex items-center gap-1.5">
            <IconDatabase size={14} className="text-emerald-400" />
            データ管理
          </p>
          <div className="space-y-2">
            <button
              onClick={handleExport}
              disabled={exporting}
              className="card-base w-full flex items-center justify-between p-4 disabled:opacity-50 active:scale-[0.99] transition text-left"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center">
                  <IconDatabase size={18} className="text-emerald-400" />
                </span>
                <div>
                  <p className="text-sm font-bold text-white">データをエクスポート</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {exporting ? "準備中..." : "自分の全データをJSONでダウンロード"}
                  </p>
                </div>
              </div>
              <IconChevronRight size={18} className="text-gray-500 flex-shrink-0" />
            </button>

            <button
              onClick={() => setShowDeleteModal(true)}
              className="card-base w-full flex items-center justify-between p-4 active:scale-[0.99] transition text-left border !border-red-500/30 hover:!border-red-500/50"
            >
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <IconTrash size={18} className="text-red-400" />
                </span>
                <div>
                  <p className="text-sm font-bold text-red-400">
                    アカウントを削除
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    すべてのデータが完全に削除されます
                  </p>
                </div>
              </div>
              <IconChevronRight size={18} className="text-red-400 flex-shrink-0" />
            </button>
          </div>
        </section>

        {/* ヘルスケア免責 */}
        <section className="card-accent-amber p-4">
          <p className="text-xs font-bold text-amber-300 mb-1.5">
            ⚠️ 本アプリは医療行為ではありません
          </p>
          <p className="text-xs text-gray-200 leading-relaxed">
            提供される情報は参考であり、診断・治療を目的とするものではありません。
            重篤な症状がある場合は医療機関を受診してください。
          </p>
        </section>

        {/* アプリ情報 */}
        <section className="card-base p-4 text-center">
          <p className="text-xs text-gray-500">ZERO-PAIN</p>
          <p className="text-[11px] text-gray-600 mt-1">
            © 2026 TopBank, Inc. All rights reserved.
          </p>
        </section>

        {/* メッセージ */}
        {message && (
          <div
            className={`rounded-xl px-4 py-3 text-sm ${
              message.type === "ok"
                ? "card-accent-emerald text-emerald-200"
                : "bg-red-500/10 border border-red-500/30 text-red-300"
            }`}
          >
            {message.text}
          </div>
        )}
      </div>

      {/* デバイス引継ぎコード発行モーダル */}
      {transferMode === "generate" && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !transferLoading && setTransferMode(null)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-blue-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-blue-400 flex items-center gap-2">
              <IconKeyRound size={20} />
              引継ぎコードの発行
            </h3>
            {!generatedCode ? (
              <>
                <p className="text-sm text-gray-300 leading-relaxed">
                  新しい端末で入力するための8桁のコードを発行します。
                  <br />
                  <span className="text-amber-300">⚠️ 1時間で失効、1回のみ使用可能</span>
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTransferMode(null)}
                    disabled={transferLoading}
                    className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-gray-300 font-bold disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleGenerateCode}
                    disabled={transferLoading}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
                  >
                    {transferLoading ? "発行中..." : "コードを発行"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-300 mb-2">あなたの引継ぎコード:</p>
                <div className="bg-gray-800 rounded-xl p-4 text-center">
                  <p className="text-3xl font-mono font-extrabold text-blue-300 tracking-widest">
                    {generatedCode}
                  </p>
                </div>
                <p className="text-[11px] text-gray-400 leading-relaxed">
                  このコードを新しい端末の「コードを入力して復元」画面で入力してください。
                  <br />
                  ⏰ 1時間で失効します。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleCopyCode}
                    className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-blue-300 font-bold flex items-center justify-center gap-2"
                  >
                    <IconCopy size={16} />
                    コピー
                  </button>
                  <button
                    onClick={() => { setTransferMode(null); setGeneratedCode(null); }}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-bold"
                  >
                    閉じる
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* デバイス引継ぎ復元モーダル */}
      {transferMode === "restore" && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !transferLoading && setTransferMode(null)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-purple-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-purple-400 flex items-center gap-2">
              <IconCopy size={20} />
              コードを入力して復元
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              前の端末で発行した8桁のコードを入力してください。
              <br />
              <span className="text-amber-300">⚠️ 現在の端末のデータは上書きされます</span>
            </p>
            <input
              type="text"
              value={restoreInput}
              onChange={(e) => setRestoreInput(e.target.value)}
              placeholder="例: K7M2-X9P4"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 text-white text-center font-mono text-xl tracking-widest border border-gray-700 focus:border-purple-500 outline-none"
              maxLength={9}
              autoCapitalize="characters"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setTransferMode(null)}
                disabled={transferLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-gray-800 text-gray-300 font-bold disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleRestore}
                disabled={transferLoading || restoreInput.length < 8}
                className="flex-1 py-3 px-4 rounded-xl bg-purple-600 text-white font-bold disabled:opacity-50"
              >
                {transferLoading ? "復元中..." : "復元する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* アカウント削除モーダル */}
      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => !deleting && setShowDeleteModal(false)}
        >
          <div
            className="w-full max-w-sm bg-gray-900 border border-red-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-extrabold text-red-400">
              🗑 アカウントを削除しますか？
            </h3>

            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-xs text-red-200 leading-relaxed">
              この操作は取り消せません。以下のすべてのデータが完全に削除されます：
              <ul className="mt-1.5 pl-4 list-disc space-y-0.5">
                <li>プロフィール情報</li>
                <li>姿勢チェック記録・写真</li>
                <li>食事記録・写真</li>
                <li>体重記録</li>
                <li>チャット履歴</li>
                <li>サブスクリプション情報（課金は別途App Storeで管理）</li>
              </ul>
            </div>

            <div>
              <p className="text-xs text-gray-400 mb-1.5">
                確認のため「<span className="text-red-400 font-bold">DELETE</span>」と入力してください
              </p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="DELETE"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                className="btn-neutral flex-1 py-2.5 text-sm"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting || deleteText !== "DELETE"}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl text-sm font-bold text-white"
              >
                {deleting ? "削除中..." : "完全に削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
