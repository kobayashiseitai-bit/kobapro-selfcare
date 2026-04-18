"use client";

import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { addRecord, getRecords, deleteRecord, Landmark, PostureRecord } from "./lib/storage";
import { analyzeFrontPosture, analyzeSidePosture, drawDiagnosisOverlay, drawSideDiagnosisOverlay, addLandmarkFrame, clearLandmarkBuffer } from "./lib/postureAnalysis";
import { getStretchesBySymptom } from "./lib/stretches";
import type { DiagnosisItem } from "./lib/storage";
// Supabase保存はAPI経由
function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("zero_pain_device_id");
  if (!id) { id = crypto.randomUUID(); localStorage.setItem("zero_pain_device_id", id); }
  return id;
}
function saveToDb(data: Record<string, unknown>) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, deviceId }),
  }).catch(() => {});
}

const SELF_ID = "self";

const POSE_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10], [11, 12],
  [11, 13], [13, 15], [15, 17], [15, 19], [15, 21],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22],
  [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [27, 31],
  [24, 26], [26, 28], [28, 30], [28, 32],
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MediaPipeModules = { PoseLandmarker: any; FilesetResolver: any; DrawingUtils: any };

type Screen = "loading" | "register" | "home" | "ai-counsel" | "selfcare" | "check" | "history" | "meal" | "subscription";

const PREFECTURES = [
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県",
  "岐阜県","静岡県","愛知県","三重県",
  "滋賀県","京都府","大阪府","兵庫県","奈良県","和歌山県",
  "鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県",
  "福岡県","佐賀県","長崎県","熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

// 症状データ（後からYouTubeのURLに差し替え可能）
const SYMPTOMS = [
  {
    id: "neck",
    label: "首こり",
    emoji: "🦴",
    icon: "/menyu2.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "首こり解消セルフケア",
    description: "首周りの筋肉をほぐし、痛みを和らげるストレッチです。",
  },
  {
    id: "shoulder_stiff",
    label: "肩凝り",
    emoji: "💪",
    icon: "/menyu6.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "肩凝り解消セルフケア",
    description: "固まった肩周りをほぐすストレッチです。",
  },
  {
    id: "back",
    label: "腰痛",
    emoji: "🔥",
    icon: "/menyu5.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "腰痛改善セルフケア",
    description: "腰回りの筋肉を緩め、腰痛を予防・改善するストレッチです。",
  },
  {
    id: "headache",
    label: "頭痛",
    emoji: "🧠",
    icon: "/menyu3.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "頭痛緩和セルフケア",
    description: "頭痛を和らげるツボ押しと首肩のストレッチです。",
  },
  {
    id: "eye_fatigue",
    label: "眼精疲労",
    emoji: "👁️",
    icon: "/menyu4.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "眼精疲労解消セルフケア",
    description: "目の疲れを取り、スッキリさせるツボ押し＆エクササイズです。",
  },
  {
    id: "kyphosis",
    label: "猫背改善",
    emoji: "🐱",
    icon: "/menyu1.jpg",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "猫背改善エクササイズ",
    description: "猫背を矯正し、正しい姿勢を身につけるエクササイズです。",
  },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);
  const [mealInitialMode, setMealInitialMode] = useState<"home" | "goal" | "calendar" | null>(null);

  const goToMealWithMode = (mode: "home" | "goal" | "calendar") => {
    setMealInitialMode(mode);
    setScreen("meal");
  };

  // 初回チェック: ユーザー登録済みかどうか
  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) { setScreen("register"); return; }
    fetch("/api/user-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then((r) => r.json())
      .then((d) => setScreen(d.registered ? "home" : "register"))
      .catch(() => setScreen("register"));
  }, []);

  const goToSelfcare = (symptomId: string) => {
    setSelectedSymptomId(symptomId);
    setScreen("selfcare");
    saveToDb({ type: "symptom", symptomId });
  };

  // ローディング中はロゴ表示
  if (screen === "loading") {
    return (
      <main className="fixed inset-0 bg-black flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash-logo.png"
          alt="ZERO-PAIN"
          className="w-full max-w-md object-contain"
        />
      </main>
    );
  }

  return (
    <>
      {screen === "register" && <RegisterScreen onComplete={() => setScreen("home")} />}
      {screen === "home" && <HomeScreen onNavigate={setScreen} onSelectSymptom={goToSelfcare} onGoToMealMode={goToMealWithMode} />}
      {screen === "ai-counsel" && <AiCounselScreen onNavigate={setScreen} onSelectSymptom={goToSelfcare} />}
      {screen === "selfcare" && <SelfcareScreen onNavigate={setScreen} initialSymptomId={selectedSymptomId} />}
      {screen === "check" && <CheckScreen onNavigate={setScreen} />}
      {screen === "history" && <HistoryScreen onNavigate={setScreen} />}
      {screen === "meal" && (
        <MealScreen
          onNavigate={setScreen}
          initialMode={mealInitialMode}
          onModeConsumed={() => setMealInitialMode(null)}
        />
      )}
      {screen === "subscription" && <SubscriptionScreen onNavigate={setScreen} />}
    </>
  );
}

// ==================== 初回登録画面 ====================
const PAIN_AREAS = [
  { id: "neck", label: "首" },
  { id: "shoulder", label: "肩" },
  { id: "back", label: "腰" },
  { id: "head", label: "頭" },
  { id: "knee", label: "膝" },
  { id: "eye", label: "目" },
  { id: "arm", label: "腕・手" },
  { id: "leg", label: "脚・足" },
];

function RegisterScreen({ onComplete }: { onComplete: () => void }) {
  const [name, setName] = useState("");
  const [prefecture, setPrefecture] = useState("");
  const [age, setAge] = useState("");
  const [painAreas, setPainAreas] = useState<string[]>([]);
  const [concerns, setConcerns] = useState("");
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);
  const [agreedTerms, setAgreedTerms] = useState(false);
  const [agreedHealth, setAgreedHealth] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const togglePain = (id: string) => {
    setPainAreas((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError("お名前を入力してください"); return; }
    if (!agreedPrivacy || !agreedTerms || !agreedHealth) {
      setError("プライバシーポリシー・利用規約・ヘルスケア注意事項への同意が必要です");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          name: name.trim(),
          prefecture,
          age: age ? parseInt(age) : null,
          painAreas: painAreas.join(","),
          concerns: concerns.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        onComplete();
      } else {
        setError("登録に失敗しました。もう一度お試しください。");
      }
    } catch {
      setError("通信エラーが発生しました。");
    }
    setSaving(false);
  };

  return (
    <main className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-y-auto">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-6">
          <div className="text-center mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/splash-logo.png" alt="ZERO-PAIN" className="w-48 h-auto mx-auto mb-4" />
            <p className="text-lg font-bold text-white">
              あなた専用の<span className="text-amber-400">AIパーソナルトレーナー</span>
            </p>
            <p className="text-base text-gray-300 mt-3 font-semibold">
              まずは基本情報を教えてください
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">お名前 <span className="text-red-400">*</span></label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 山田太郎"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">お住まいの都道府県</label>
              <select
                value={prefecture}
                onChange={(e) => setPrefecture(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
              >
                <option value="">選択してください</option>
                {PREFECTURES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">年齢</label>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="例: 35"
                min="1"
                max="120"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-2">痛みのある部位（複数選択可）</label>
              <div className="grid grid-cols-4 gap-2">
                {PAIN_AREAS.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => togglePain(area.id)}
                    className={`py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                      painAreas.includes(area.id)
                        ? "bg-blue-600 text-white border-2 border-blue-400"
                        : "bg-gray-800 text-gray-400 border-2 border-gray-700"
                    }`}
                  >
                    {area.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">お悩み・気になること</label>
              <textarea
                value={concerns}
                onChange={(e) => setConcerns(e.target.value)}
                placeholder="例: デスクワークで肩こりがひどい、朝起きると腰が痛い など"
                rows={3}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm resize-none"
              />
            </div>
          </div>

          {/* ヘルスケア免責 */}
          <div className="card-accent-amber p-4">
            <p className="text-sm font-bold text-amber-300 mb-1.5">
              ⚠️ ご利用前に必ずお読みください
            </p>
            <p className="text-xs text-gray-200 leading-relaxed">
              本アプリは、整体師の一般的な知見に基づくセルフケア情報を提供するものであり、
              医療行為・診断・治療を目的とするものではありません。
              重篤な痛みやしびれ、急激な体調変化がある場合は必ず医療機関を受診してください。
              妊娠中の方、持病のある方はかかりつけ医にご相談のうえご利用ください。
            </p>
          </div>

          {/* 同意チェックボックス */}
          <div className="space-y-2.5">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedPrivacy}
                onChange={(e) => setAgreedPrivacy(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-emerald-500"
              />
              <span className="text-xs text-gray-200 leading-relaxed flex-1">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener"
                  className="text-emerald-400 underline"
                >
                  プライバシーポリシー
                </a>
                を読み、内容に同意します
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedTerms}
                onChange={(e) => setAgreedTerms(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-emerald-500"
              />
              <span className="text-xs text-gray-200 leading-relaxed flex-1">
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener"
                  className="text-emerald-400 underline"
                >
                  利用規約
                </a>
                を読み、内容に同意します
              </span>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedHealth}
                onChange={(e) => setAgreedHealth(e.target.checked)}
                className="mt-0.5 w-5 h-5 accent-emerald-500"
              />
              <span className="text-xs text-gray-200 leading-relaxed flex-1">
                本アプリが医療行為ではないことを理解し、
                重篤な症状がある場合は医療機関を受診することに同意します
              </span>
            </label>
          </div>

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving || !agreedPrivacy || !agreedTerms || !agreedHealth}
            className="btn-primary w-full py-4 text-lg disabled:opacity-50"
          >
            {saving ? "登録中..." : "はじめる"}
          </button>

          <p className="text-center text-gray-500 text-[11px]">
            入力された情報はセルフケアの改善に活用されます。いつでも設定画面から削除できます。
          </p>
        </form>
      </div>
    </main>
  );
}


// ==================== ホーム画面 ====================
function HomeScreen({
  onNavigate,
  onSelectSymptom,
  onGoToMealMode,
}: {
  onNavigate: (s: Screen) => void;
  onSelectSymptom: (id: string) => void;
  onGoToMealMode: (mode: "home" | "goal" | "calendar") => void;
}) {
  const records = getRecords(SELF_ID);
  const [prediction, setPrediction] = useState<{
    prediction: string; detail?: string; riskLevel: string; symptomId: string | null;
  } | null>(null);
  const [reminderHours, setReminderHours] = useState<number | null>(null);
  const [reminderAlert, setReminderAlert] = useState<string | null>(null);
  const [showReminderSetting, setShowReminderSetting] = useState(false);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // 痛み予測を取得 + プロフィール完成度チェック
  useEffect(() => {
    const deviceId = getDeviceId();
    if (!deviceId) return;
    fetch("/api/predict", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then((r) => r.json())
      .then((d) => { if (d.prediction) setPrediction(d); })
      .catch(() => {});

    fetch("/api/user-profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceId }),
    })
      .then((r) => r.json())
      .then((d) => { setProfileComplete(d.profileComplete === true); })
      .catch(() => {});
  }, []);

  // Capacitor環境検出
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isNativePlatform = () => {
    if (typeof window === "undefined") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    return cap?.isNativePlatform?.() === true;
  };

  // ネイティブ通知をスケジュール
  const scheduleNativeNotification = async (hours: number) => {
    if (!isNativePlatform()) return;
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      // 既存通知をキャンセル
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
      // 権限取得
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return;
      // 新しい通知をスケジュール
      const intervalMs = hours * 60 * 60 * 1000;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 1,
            title: "ZERO-PAIN リマインダー",
            body: `${hours}時間経ちました。体を動かしましょう！簡単なストレッチで体をリセット💪`,
            schedule: {
              at: new Date(Date.now() + intervalMs),
              repeats: true,
              every: "hour",
            },
            sound: "default",
          },
        ],
      });
    } catch (e) {
      console.error("Native notification schedule error:", e);
    }
  };

  // ネイティブ通知をキャンセル
  const cancelNativeNotification = async () => {
    if (!isNativePlatform()) return;
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: 1 }] });
    } catch (e) {
      console.error("Native notification cancel error:", e);
    }
  };

  // リマインダーチェック
  useEffect(() => {
    const saved = localStorage.getItem("zero_pain_reminder_hours");
    if (saved) setReminderHours(parseInt(saved));

    const lastActive = localStorage.getItem("zero_pain_last_active");
    const hours = saved ? parseInt(saved) : null;
    if (lastActive && hours) {
      const elapsed = (Date.now() - parseInt(lastActive)) / (1000 * 60 * 60);
      if (elapsed >= hours) {
        setReminderAlert(`前回のアクセスから${Math.floor(elapsed)}時間経過しています。簡単なストレッチをしましょう！`);
      }
    }
    localStorage.setItem("zero_pain_last_active", String(Date.now()));

    // ネイティブ環境: ローカル通知をセットアップ
    if (isNativePlatform()) {
      if (hours) {
        scheduleNativeNotification(hours);
      }
      return;
    }

    // Web環境: 既存のブラウザ通知ロジック
    if (lastActive && hours) {
      const elapsed = (Date.now() - parseInt(lastActive)) / (1000 * 60 * 60);
      if (elapsed >= hours && "Notification" in window && Notification.permission === "granted") {
        new Notification("ZERO-PAIN リマインダー", {
          body: `${Math.floor(elapsed)}時間座りっぱなしではありませんか？ストレッチをしましょう！`,
          icon: "/app-icon-192.png",
        });
      }
    }

    // ブラウザ通知許可を要求（初回のみ）
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }

    // アプリ内タイマー（開いている間）
    const timerId = setInterval(() => {
      const h = parseInt(localStorage.getItem("zero_pain_reminder_hours") || "0");
      if (h > 0) {
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("ZERO-PAIN ストレッチタイム", {
            body: `${h}時間経ちました。体を動かしましょう！`,
            icon: "/app-icon-192.png",
          });
        }
      }
    }, (parseInt(saved || "0") || 999) * 60 * 60 * 1000);

    return () => clearInterval(timerId);
  }, []);

  const saveReminder = (hours: number) => {
    setReminderHours(hours);
    localStorage.setItem("zero_pain_reminder_hours", String(hours));
    localStorage.setItem("zero_pain_last_active", String(Date.now()));
    setShowReminderSetting(false);
    setReminderAlert(null);
    // ネイティブ環境ではローカル通知を再スケジュール
    scheduleNativeNotification(hours);
  };

  const riskColors: Record<string, string> = {
    high: "from-red-500/20 to-red-600/10 border-red-500/30",
    medium: "from-amber-500/20 to-amber-600/10 border-amber-500/30",
    low: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30",
  };
  const riskIcons: Record<string, string> = { high: "🔴", medium: "⚠️", low: "✅" };

  return (
    <main className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-y-auto">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="w-12" />
        <h1 className="text-lg font-extrabold tracking-[0.2em]">ZERO-PAIN</h1>
        <button
          onClick={() => setShowMenu(true)}
          aria-label="メニュー"
          className="w-12 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-95 transition"
        >
          {/* 3本線のハンバーガーアイコン */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="w-5 h-5 text-gray-200"
          >
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
      </header>

      {/* ハンバーガーメニュー展開シート */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm flex items-start justify-end"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-72 max-w-full h-full bg-gray-950 border-l border-white/10 p-4 space-y-2 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <p className="text-base font-bold">メニュー</p>
              <button
                onClick={() => setShowMenu(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5"
                aria-label="閉じる"
              >
                ✕
              </button>
            </div>

            <button
              onClick={() => { setShowMenu(false); onNavigate("subscription"); }}
              className="card-base w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">👑</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">プラン管理</p>
                <p className="text-[11px] text-gray-400">サブスク状態・利用回数</p>
              </div>
              <span className="text-gray-500">›</span>
            </button>

            <a
              href="/settings"
              className="card-base w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">⚙️</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">設定</p>
                <p className="text-[11px] text-gray-400">アカウント・データ管理</p>
              </div>
              <span className="text-gray-500">›</span>
            </a>

            <a
              href="/support"
              className="card-base w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">💬</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">サポート</p>
                <p className="text-[11px] text-gray-400">FAQ・お問い合わせ</p>
              </div>
              <span className="text-gray-500">›</span>
            </a>

            <a
              href="/privacy"
              className="card-base w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">🔒</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">プライバシーポリシー</p>
                <p className="text-[11px] text-gray-400">データ取扱いについて</p>
              </div>
              <span className="text-gray-500">›</span>
            </a>

            <a
              href="/terms"
              className="card-base w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">📄</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">利用規約</p>
                <p className="text-[11px] text-gray-400">本アプリの利用条件</p>
              </div>
              <span className="text-gray-500">›</span>
            </a>

            <div className="pt-4 text-center">
              <p className="text-[11px] text-gray-500">ZERO-PAIN</p>
              <p className="text-[11px] text-gray-600">© 2026 TopBank, Inc.</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 py-5 space-y-5 max-w-md w-full mx-auto">
        {/* リマインダーアラート */}
        {reminderAlert && (
          <div className="card-accent-amber px-4 py-3">
            <p className="text-sm text-amber-200 font-semibold">⏰ {reminderAlert}</p>
            <button
              onClick={() => { setReminderAlert(null); onSelectSymptom("neck"); }}
              className="mt-2 px-4 py-2 bg-amber-600 rounded-xl text-xs font-bold text-white"
            >
              今すぐストレッチする
            </button>
          </div>
        )}

        {/* プロフィール未完成バナー */}
        {profileComplete === false && (
          <button
            onClick={() => onGoToMealMode("goal")}
            className="card-accent-indigo w-full text-left relative overflow-hidden transition active:scale-[0.99]"
          >
            <span className="badge-new absolute top-3 right-3 z-10">未設定</span>
            <div className="px-5 py-5 flex items-center gap-4">
              <span className="text-5xl">👤</span>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-bold text-white leading-tight">
                  ガイコツ先生が<br />あなた専用に計算
                </p>
                <p className="text-sm text-indigo-200 mt-1.5 leading-snug">
                  身長・体重で最適カロリー算出
                </p>
              </div>
              <span className="text-2xl text-indigo-300">›</span>
            </div>
          </button>
        )}

        {/* ガイコツ先生の痛み予測カード */}
        {prediction && (
          <button
            onClick={() => prediction.symptomId ? onSelectSymptom(prediction.symptomId) : onNavigate("ai-counsel")}
            className="card-base w-full text-left p-4 relative overflow-hidden active:scale-[0.99] transition"
          >
            <span
              className={`absolute left-0 top-0 bottom-0 w-1 ${
                prediction.riskLevel === "high"
                  ? "bg-red-500"
                  : prediction.riskLevel === "medium"
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />
            <div className="flex items-start gap-3 pl-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                className="w-11 h-11 object-contain flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-gray-400 font-bold mb-1 tracking-wide flex items-center gap-1.5">
                  <span>{riskIcons[prediction.riskLevel] || "✅"}</span>
                  <span>ガイコツ先生の痛み予測</span>
                </p>
                <p className="text-base font-bold text-white leading-tight">{prediction.prediction}</p>
                {prediction.detail && (
                  <p className="text-sm text-gray-300 mt-1.5 leading-relaxed">{prediction.detail}</p>
                )}
                <p className="text-xs text-emerald-400 mt-2 font-semibold">タップしてケアを開始 →</p>
              </div>
            </div>
          </button>
        )}

        {/* ガイコツ先生の今日の一言（旬の食材・豆知識） */}
        <DailyTipCard />

        {/* 今日の食事ダッシュボード（週間カレンダー + 区分別サマリ） */}
        <TodayMealDashboard onGoToMealMode={onGoToMealMode} onOpenMeal={() => onNavigate("meal")} />

        {/* リマインダー設定 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowReminderSetting(!showReminderSetting)}
            className="text-xs text-gray-500 flex items-center gap-1"
          >
            ⏰ リマインダー: {reminderHours ? `${reminderHours}時間ごと` : "未設定"}
          </button>
        </div>
        {showReminderSetting && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
            <p className="text-sm text-gray-300 mb-3">ストレッチリマインダー間隔</p>
            <div className="flex gap-2">
              {[1, 2, 3].map((h) => (
                <button
                  key={h}
                  onClick={() => saveReminder(h)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold ${
                    reminderHours === h ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  {h}時間
                </button>
              ))}
              <button
                onClick={() => { setReminderHours(null); localStorage.removeItem("zero_pain_reminder_hours"); setShowReminderSetting(false); cancelNativeNotification(); }}
                className="flex-1 py-2 rounded-lg text-sm bg-gray-800 text-gray-400"
              >
                OFF
              </button>
            </div>
          </div>
        )}

        {/* Step 1: 姿勢チェック */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 1 · 姿勢チェック</h2>
          <button
            onClick={() => onNavigate("check")}
            className="btn-primary w-full px-5 py-5 flex items-center gap-4"
          >
            <span className="text-4xl">🧍</span>
            <div className="text-left">
              <p className="text-base font-bold">ZERO-PAIN AIで姿勢スキャン</p>
              <p className="text-sm text-emerald-50/90 mt-0.5">スマホを置いて全身撮影 → 歪みを自動チェック</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("history")}
            disabled={records.length === 0}
            className="btn-neutral w-full px-5 py-3.5 flex items-center gap-3 disabled:opacity-40"
          >
            <span className="text-xl">📊</span>
            <div className="text-left">
              <p className="text-sm font-bold">過去の記録を見る</p>
              <p className="text-[11px] text-gray-400">
                {records.length > 0 ? `${records.length}件の記録` : "まだ記録がありません"}
              </p>
            </div>
          </button>
        </div>

        {/* Step 2: AIカウンセリング */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 2 · AI相談</h2>

          {/* パーソナルトレーナー統合ボタン */}
          <button
            onClick={() => onNavigate("ai-counsel")}
            className="w-full rounded-2xl overflow-hidden text-left shadow-[0_8px_24px_rgba(99,102,241,0.35)] active:scale-[0.99] transition"
          >
            {/* 上段: パーソナルトレーナー訴求バー（独立・重ならない） */}
            <div className="bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 px-4 py-2 flex items-center gap-1.5">
              <span className="text-sm">✨</span>
              <p className="text-xs font-extrabold text-amber-950 tracking-wide">
                あなた専用のパーソナルトレーナー
              </p>
            </div>
            {/* 下段: ガイコツ先生 + タイトル */}
            <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-indigo-800 flex items-center gap-3 px-4 py-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-skeleton-sensei.png"
                alt="ガイコツ先生"
                className="w-20 h-20 object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-white leading-tight">
                  ガイコツ先生に相談
                </p>
                <p className="text-sm text-indigo-100 mt-1 leading-snug">
                  お悩みを聞き取り最適なケアを提案
                </p>
              </div>
              <span className="text-xl text-indigo-300">›</span>
            </div>
          </button>
        </div>

        {/* Step 3: 食事記録 */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Step 3 · 食事を撮って相談</h2>
          <button
            onClick={() => onNavigate("meal")}
            className="btn-primary w-full text-left flex items-center gap-4 px-5 py-5 relative overflow-hidden"
          >
            <span className="badge-new absolute top-3 right-3">NEW</span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-skeleton-sensei-face.png"
              alt="ガイコツ先生"
              className="w-12 h-12 object-contain flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-base font-bold text-white leading-tight">
                ガイコツ先生の食事分析
              </p>
              <p className="text-sm text-emerald-50/90 mt-1 leading-snug">
                写真1枚で栄養×姿勢ケアをチェック
              </p>
            </div>
            <span className="text-2xl text-white/80">›</span>
          </button>
        </div>

        {/* Step 4: 症状選択 */}
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">Step 4 · セルフケアメニュー</h2>
          <div className="grid grid-cols-2 gap-3">
            {SYMPTOMS.map((symptom) => (
              <button
                key={symptom.id}
                onClick={() => onSelectSymptom(symptom.id)}
                className="btn-3d rounded-2xl overflow-hidden aspect-square"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={symptom.icon} alt={symptom.label} className="w-full h-full object-cover block" />
              </button>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}

// ==================== AIカウンセリング画面 ====================
type ChatMessage = { role: "user" | "assistant"; content: string };

function AiCounselScreen({ onNavigate, onSelectSymptom }: { onNavigate: (s: Screen) => void; onSelectSymptom: (id: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ストリーミングAPIを呼び出す共通関数
  const streamChat = async (
    apiMessages: ChatMessage[],
    onText: (delta: string) => void
  ): Promise<{ cleanText: string; recommendedSymptomId: string | null }> => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
        deviceId: getDeviceId(),
      }),
    });
    if (!res.body) throw new Error("No response body");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let cleanText = "";
    let recommendedSymptomId: string | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSEはdata: {...}\n\nの形式
      const lines = buffer.split("\n\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6);
        try {
          const data = JSON.parse(jsonStr);
          if (data.text) {
            onText(data.text);
          }
          if (data.done) {
            cleanText = data.cleanText || "";
            recommendedSymptomId = data.recommendedSymptomId || null;
          }
          if (data.error) {
            throw new Error(data.error);
          }
        } catch { /* parse error skip */ }
      }
    }
    return { cleanText, recommendedSymptomId };
  };

  // 初期ロード：過去のチャット履歴を復元 or 初回メッセージ送信
  useEffect(() => {
    async function initChat() {
      // 1. まず過去のチャット履歴を取得
      try {
        const deviceId = getDeviceId();
        const res = await fetch(
          `/api/chat/history?deviceId=${encodeURIComponent(deviceId || "")}`
        );
        const data = await res.json();

        if (data.hasHistory && data.messages && data.messages.length > 0) {
          // 履歴がある場合：そのまま表示して続きから会話
          const restored: ChatMessage[] = data.messages
            .filter((m: { role: string }) => m.role === "user" || m.role === "assistant")
            .map((m: { role: "user" | "assistant"; content: string }) => ({
              role: m.role,
              content: m.content,
            }));
          setMessages(restored);

          // 前回から時間が経っている場合、さりげなく「お久しぶり」的な軽い挨拶を足す
          if (data.resumeMode === "previous" && data.daysSinceLast > 0) {
            const welcomeBack =
              data.daysSinceLast === 1
                ? "おかえりなさい！昨日以来ですね。その後お体の調子はいかがですか？"
                : `おかえりなさい！${data.daysSinceLast}日ぶりですね。その後お体の調子はいかがですか？`;
            setMessages([
              ...restored,
              { role: "assistant" as const, content: welcomeBack },
            ]);
          } else if (data.resumeMode === "same_day" && data.hoursSinceLast >= 1) {
            const welcomeBack = `先ほどに続きですね。お体の調子はいかがですか？`;
            setMessages([
              ...restored,
              { role: "assistant" as const, content: welcomeBack },
            ]);
          }
          // continue（30分以内）なら完全に続きから。追加メッセージなし
          setHistoryLoaded(true);
          return;
        }
      } catch {
        // 履歴取得失敗時は通常の初回メッセージにフォールバック
      }

      // 2. 履歴がない or 失敗：初回メッセージをAIに生成させる
      setLoading(true);
      setMessages([{ role: "assistant", content: "" }]);
      let streamedText = "";
      try {
        const result = await streamChat([], (delta) => {
          streamedText += delta;
          const display = streamedText.replace(/<recommendation>[\s\S]*$/, "");
          setMessages([{ role: "assistant", content: display }]);
        });
        if (result.cleanText) {
          setMessages([{ role: "assistant", content: result.cleanText }]);
        }
      } catch {
        const fallback = "こんにちは！今日はどんなお悩みが気になりますか？お気軽にお話しください。";
        setMessages([{ role: "assistant", content: fallback }]);
      }
      setLoading(false);
      setHistoryLoaded(true);
    }
    initChat();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    // 空のアシスタントメッセージを追加（ストリーミング表示用）
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    let streamedText = "";
    try {
      const result = await streamChat(newMessages, (delta) => {
        streamedText += delta;
        const display = streamedText.replace(/<recommendation>[\s\S]*$/, "");
        setMessages([...newMessages, { role: "assistant", content: display }]);
      });

      const finalText = result.cleanText || streamedText;
      setMessages([...newMessages, { role: "assistant", content: finalText }]);

      // DBに保存
      saveToDb({ type: "chat", role: "user", content: userMsg.content });
      saveToDb({
        type: "chat",
        role: "assistant",
        content: finalText,
        recommendedSymptom: result.recommendedSymptomId,
      });

      if (result.recommendedSymptomId) {
        setRecommendedId(result.recommendedSymptomId);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "すみません、通信エラーが発生しました。もう一度お試しください。" },
      ]);
    }
    setLoading(false);
  };

  const recommendedSymptom = SYMPTOMS.find((s) => s.id === recommendedId);

  return (
    <main className="fixed inset-0 bg-gray-950 text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => onNavigate("home")} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">← 戻る</button>
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-skeleton-sensei-face.png" alt="ガイコツ先生" className="w-10 h-10 object-contain" />
          <h1 className="text-base font-bold">ガイコツ先生のカウンセリング</h1>
        </div>
      </header>

      {/* チャットエリア */}
      <div className="flex-1 overflow-y-auto space-y-3 px-4 py-4 max-w-md w-full mx-auto">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-blue-600 rounded-br-md"
                : "bg-gray-800 rounded-bl-md"
            }`}>
              {msg.role === "assistant" && <p className="text-xs text-gray-400 mb-1">💀 ガイコツ先生</p>}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
              <p className="text-xs text-gray-400 mb-1">💀 ガイコツ先生</p>
              <p className="text-sm animate-pulse">考え中...</p>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* おすすめセルフケアボタン */}
      {recommendedSymptom && (
        <div className="max-w-md w-full mx-auto mb-3">
          <button
            onClick={() => onSelectSymptom(recommendedId!)}
            className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl font-semibold text-sm flex items-center gap-3"
          >
            <span className="text-2xl">{recommendedSymptom.icon}</span>
            <div className="text-left">
              <p className="font-bold">おすすめ: {recommendedSymptom.videoTitle}</p>
              <p className="text-xs opacity-80">タップしてセルフケア動画を見る</p>
            </div>
          </button>
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-gray-800 px-4 py-3 max-w-md w-full mx-auto flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !("isComposing" in e.nativeEvent && e.nativeEvent.isComposing)) sendMessage(); }}
          placeholder="お悩みを入力..."
          className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
          disabled={loading}
        />
        <button
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-xl font-semibold text-sm"
        >
          送信
        </button>
      </div>
    </main>
  );
}

// ==================== セルフケア画面（症状→動画） ====================
function SelfcareScreen({ onNavigate, initialSymptomId }: { onNavigate: (s: Screen) => void; initialSymptomId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSymptomId);
  const activeSymptom = SYMPTOMS.find((s) => s.id === selectedId);
  const stretches = selectedId ? getStretchesBySymptom(selectedId) : [];

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button onClick={() => onNavigate("home")} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 戻る</button>
        <h1 className="text-lg font-bold">セルフケア</h1>
      </div>

      <p className="text-gray-400 text-sm mb-4 w-full max-w-md">
        気になる箇所を選んでください
      </p>

      <div className="w-full max-w-md grid grid-cols-2 gap-3">
        {SYMPTOMS.map((symptom) => (
          <button
            key={symptom.id}
            onClick={() => setSelectedId(selectedId === symptom.id ? null : symptom.id)}
            className={`font-semibold transition-all active:scale-95 ${
              selectedId === symptom.id
                ? "ring-2 ring-blue-400 rounded-2xl"
                : ""
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={symptom.icon} alt={symptom.label} className="w-full aspect-square object-cover rounded-2xl" />
            <p className={`text-sm font-bold py-2 text-center ${selectedId === symptom.id ? "text-blue-400" : "text-white"}`}>{symptom.label}</p>
          </button>
        ))}
      </div>

      {activeSymptom && stretches.length > 0 && (
        <div className="w-full max-w-md mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-blue-400">
              {activeSymptom.label}のセルフケア
            </h3>
            <span className="text-xs text-gray-500">{stretches.length}種類</span>
          </div>


          {stretches.map((stretch, i) => (
            <div key={stretch.id} className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
              {/* 画像エリア */}
              <div className="relative w-full aspect-video bg-gray-900">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stretch.image}
                  alt={stretch.title}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                  {i + 1}/{stretches.length}
                </div>
              </div>

              {/* 内容 */}
              <div className="p-4 space-y-3">
                <h4 className="font-bold text-base">{stretch.title}</h4>

                {/* 時間・回数 */}
                <div className="flex gap-2">
                  <span className="bg-blue-900/40 text-blue-300 text-xs px-3 py-1 rounded-full font-semibold">
                    ⏱ {stretch.duration}
                  </span>
                  <span className="bg-purple-900/40 text-purple-300 text-xs px-3 py-1 rounded-full font-semibold">
                    🔄 {stretch.reps}
                  </span>
                </div>

                {/* 手順 */}
                <div>
                  <p className="text-xs text-gray-400 font-semibold mb-1">▶ やり方</p>
                  <ol className="space-y-1 pl-4">
                    {stretch.steps.map((step, j) => (
                      <li key={j} className="text-sm text-gray-200 list-decimal">
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* コツ */}
                <div className="bg-amber-900/20 border-l-2 border-amber-400 pl-3 py-1">
                  <p className="text-xs text-amber-300 font-semibold mb-0.5">💡 ポイント</p>
                  <p className="text-xs text-gray-300">{stretch.tips}</p>
                </div>

                {/* 効果 */}
                <div className="text-xs text-gray-500">
                  <span className="font-semibold">効果:</span> {stretch.benefit}
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => setSelectedId(null)}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 rounded-xl text-sm font-semibold"
          >
            閉じる
          </button>
        </div>
      )}
    </main>
  );
}

// ==================== 音声ガイド ====================
// テキストのキーワードに対応する音声ファイル
const VOICE_KEYWORDS: { keyword: string; file: string }[] = [
  { keyword: "側面の写真撮影", file: "/voice-side-guide.mp3" },
  { keyword: "横向きのままカメラの前", file: "/voice-side-stand.mp3" },
  { keyword: "横向きでストップ", file: "/voice-side-stop.mp3" },
  { keyword: "横向きの撮影が完了", file: "/voice-side-done.mp3" },
  { keyword: "上半身が映るように位置", file: "/voice-adjust.mp3" },
  { keyword: "上半身全体が映るように", file: "/voice-adjust.mp3" },
  { keyword: "全身が映る", file: "/voice-stand.mp3" },
  { keyword: "カメラの前に立って", file: "/voice-stand.mp3" },
  { keyword: "足元が映る", file: "/voice-back.mp3" },
  { keyword: "離れて", file: "/voice-back.mp3" },
  { keyword: "近づいて", file: "/voice-closer.mp3" },
  { keyword: "右に移動", file: "/voice-right.mp3" },
  { keyword: "左に移動", file: "/voice-left.mp3" },
  { keyword: "そのままの位置でストップ", file: "/voice-stop.mp3" },
  { keyword: "撮影しました", file: "/voice-done.mp3" },
];

// 全音声ファイルをプリロード
const ALL_VOICE_FILES = [
  "/voice-stand.mp3", "/voice-back.mp3", "/voice-closer.mp3",
  "/voice-right.mp3", "/voice-left.mp3", "/voice-stop.mp3",
  "/voice-5.mp3", "/voice-4.mp3", "/voice-3.mp3",
  "/voice-2.mp3", "/voice-1.mp3", "/voice-done.mp3",
  "/voice-side-guide.mp3", "/voice-side-stand.mp3",
  "/voice-side-stop.mp3", "/voice-side-done.mp3",
  "/voice-adjust.mp3", "/voice-captured.mp3",
];
const audioCache: Record<string, HTMLAudioElement> = {};
let audioUnlocked = false;
let isSpeaking = false;

// iOSオーディオのロック解除 + プリロード（ユーザータップ時に呼ぶ）
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  ALL_VOICE_FILES.forEach((file) => {
    const a = new Audio(file);
    a.preload = "auto";
    a.volume = 1;
    // iOSでは一度playしないとロック解除されない
    a.play().then(() => { a.pause(); a.currentTime = 0; }).catch(() => {});
    audioCache[file] = a;
  });
}

function speak(text: string, force = false) {
  try {
    if (typeof window === "undefined") return;
    if (isSpeaking && !force) return;

    let file: string | null = null;

    if (text === "5") file = "/voice-5.mp3";
    else if (text === "4") file = "/voice-4.mp3";
    else if (text === "3") file = "/voice-3.mp3";
    else if (text === "2") file = "/voice-2.mp3";
    else if (text === "1") file = "/voice-1.mp3";
    else {
      const match = VOICE_KEYWORDS.find((v) => text.includes(v.keyword));
      if (match) file = match.file;
    }

    if (!file) return; // マッチしない場合は無音

    // 前の音声を停止
    Object.values(audioCache).forEach((a) => { a.pause(); a.currentTime = 0; });

    isSpeaking = true;
    let audio = audioCache[file];
    if (!audio) {
      audio = new Audio(file);
      audioCache[file] = audio;
    }
    audio.currentTime = 0;
    audio.onended = () => { isSpeaking = false; };
    audio.onerror = () => { isSpeaking = false; };
    audio.play().catch(() => { isSpeaking = false; });
  } catch { isSpeaking = false; }
}

// 全身が映っているか判定（isSide: 横向き撮影モード）
function checkFullBody(lm: Landmark[], isSide = false): { ok: boolean; guide: string } {
  if (lm.length < 33) return { ok: false, guide: "人物が見つかりません" };

  const HEAD = lm[0];
  const L_ANKLE = lm[27];
  const R_ANKLE = lm[28];
  const L_SHOULDER = lm[11];
  const R_SHOULDER = lm[12];
  const L_HIP = lm[23];
  const R_HIP = lm[24];

  const vis = (l: Landmark) => (l.visibility ?? 0) > 0.5;
  const headVis = vis(HEAD);
  const ankleVis = vis(L_ANKLE) || vis(R_ANKLE); // 横向きは片足見えればOK
  const shoulderVis = vis(L_SHOULDER) || vis(R_SHOULDER); // 横向きは片肩見えればOK
  const hipVis = vis(L_HIP) || vis(R_HIP);

  if (!headVis && !shoulderVis) {
    return { ok: false, guide: isSide ? "横向きのままカメラの前に立ってください" : "カメラの前に立ってください" };
  }
  if (!shoulderVis || !hipVis) {
    return { ok: false, guide: isSide ? "上半身が映るように位置を調整してください" : "上半身全体が映るように立ってください" };
  }
  if (!ankleVis) {
    return { ok: false, guide: "もう少し離れてください。足元が映るように" };
  }

  // 中央にいるか
  const cx = (L_SHOULDER.x + R_SHOULDER.x) / 2;
  if (cx < 0.3) return { ok: false, guide: "もう少し右に移動してください" };
  if (cx > 0.7) return { ok: false, guide: "もう少し左に移動してください" };

  // 大きすぎ/小さすぎ
  const bodyHeight = Math.abs(HEAD.y - ((L_ANKLE.y + R_ANKLE.y) / 2));
  if (bodyHeight > 0.85) return { ok: false, guide: "もう少し離れてください" };
  if (bodyHeight < 0.4) return { ok: false, guide: "もう少し近づいてください" };

  if (!isSide) {
    // 正面: 体が正面を向いているか確認
    const shoulderWidth = Math.abs(L_SHOULDER.x - R_SHOULDER.x);
    if (shoulderWidth < 0.05) return { ok: false, guide: "体を正面に向けてください" };
  }

  return { ok: true, guide: isSide ? "そのまま横向きでストップ！" : "そのままの位置でストップ！" };
}

// ==================== 撮影＋診断画面（AIガイド付き） ====================
function CheckScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const guideCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [captured, setCaptured] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initStatus, setInitStatus] = useState("モデルを読み込み中...");
  const [modelReady, setModelReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagnosis, setDiagnosis] = useState<DiagnosisItem[]>([]);
  const [landmarks, setLandmarks] = useState<Landmark[]>([]);
  const [saved, setSaved] = useState(false);
  const [photoSaved, setPhotoSaved] = useState(false);
  const [captureStep, setCaptureStep] = useState<"front" | "side" | "done">("front");
  const captureStepRef = useRef<"front" | "side" | "done">("front");
  const [frontDiagnosis, setFrontDiagnosis] = useState<DiagnosisItem[]>([]);
  const frontDiagnosisRef = useRef<DiagnosisItem[]>([]);
  const [frontImageData, setFrontImageData] = useState<string>("");
  const [guideText, setGuideText] = useState("スマホを立てかけて、スタートを押してください");
  const [guideMode, setGuideMode] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [guideBorderColor, setGuideBorderColor] = useState("border-gray-700");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const poseLandmarkerRef = useRef<any>(null);
  const mpModulesRef = useRef<MediaPipeModules | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const guideLoopRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const lastSpokenRef = useRef("");
  const readyCountRef = useRef(0);

  // MediaPipe初期化 (VIDEO mode)
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        setInitStatus("MediaPipe ライブラリを読み込み中...");
        const mp = await import("@mediapipe/tasks-vision");
        if (cancelled) return;
        mpModulesRef.current = mp;
        setInitStatus("WASM を初期化中...");
        const vision = await mp.FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm"
        );
        if (cancelled) return;
        setInitStatus("姿勢検出モデルを読み込み中...");
        let landmarker;
        try {
          landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
              delegate: "GPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.7,
            minPosePresenceConfidence: 0.7,
            minTrackingConfidence: 0.7,
          });
        } catch {
          // GPU失敗時はCPUにフォールバック
          landmarker = await mp.PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",
              delegate: "CPU",
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.7,
            minPosePresenceConfidence: 0.7,
            minTrackingConfidence: 0.7,
          });
        }
        if (cancelled) return;
        poseLandmarkerRef.current = landmarker;
        setModelReady(true);
        setInitStatus("");
      } catch (e) {
        console.error("PoseLandmarker init error:", e);
        if (!cancelled) {
          setError(`初期化に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
          setInitStatus("");
        }
      }
    }
    init();
    return () => { cancelled = true; };
  }, []);

  // カメラ起動
  useEffect(() => {
    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => setCameraReady(true);
        }
      } catch {
        setError("カメラへのアクセスが拒否されました。");
      }
    }
    startCamera();
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
      if (guideLoopRef.current) cancelAnimationFrame(guideLoopRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  // AIガイドモード開始（正面・横向き共通）
  const startGuideForStep = useRef<"front" | "side">("front");
  const startGuide = useCallback(() => {
    unlockAudio();
    setGuideMode(true);
    setCaptured(false);

    if (startGuideForStep.current === "side") {
      setGuideText("横向きのままカメラの前に立ってください");
      speak("横向きのままカメラの前に立ってください", true);
    } else {
      setGuideText("カメラの前に全身が映る位置に立ってください");
      speak("カメラの前に立ってください。全身が映る位置まで下がってください。", true);
    }
    readyCountRef.current = 0;
    lastSpokenRef.current = "";
    clearLandmarkBuffer();

    const detectLoop = () => {
      const video = videoRef.current;
      const landmarker = poseLandmarkerRef.current;
      if (!video || !landmarker || video.readyState < 2) {
        guideLoopRef.current = requestAnimationFrame(detectLoop);
        return;
      }

      try {
        const result = landmarker.detectForVideo(video, performance.now());
        if (result.landmarks.length > 0) {
          const lm: Landmark[] = result.landmarks[0];
          addLandmarkFrame(lm);
          const check = checkFullBody(lm, startGuideForStep.current === "side");

          // ガイドキャンバスにシルエット描画
          const gc = guideCanvasRef.current;
          if (gc) {
            gc.width = video.videoWidth;
            gc.height = video.videoHeight;
            const gctx = gc.getContext("2d")!;
            gctx.clearRect(0, 0, gc.width, gc.height);
            // ランドマーク点を描画
            lm.forEach((l) => {
              if ((l.visibility ?? 0) > 0.5) {
                gctx.beginPath();
                gctx.arc(l.x * gc.width, l.y * gc.height, 5, 0, Math.PI * 2);
                gctx.fillStyle = check.ok ? "#22c55e" : "#eab308";
                gctx.fill();
              }
            });
          }

          setGuideText(check.guide);
          setGuideBorderColor(check.ok ? "border-green-500" : "border-yellow-500");

          // 位置が合っていない場合 → 位置誘導の音声（同じ内容は繰り返さない）
          if (!check.ok) {
            if (check.guide !== lastSpokenRef.current && !isSpeaking) {
              speak(check.guide);
              lastSpokenRef.current = check.guide;
            }
            readyCountRef.current = 0;
          }

          if (check.ok) {
            readyCountRef.current++;
            // 3秒間（約90フレーム）安定したらカウントダウン開始
            if (readyCountRef.current > 90) {
              // 音声再生中なら待つ
              if (isSpeaking) {
                readyCountRef.current = 80; // 少し待ってリトライ
              } else {
                startCountdown(lm);
                return; // ループ停止
              }
            }
          } else {
            readyCountRef.current = 0;
          }
        } else {
          setGuideText("カメラの前に立ってください");
          setGuideBorderColor("border-yellow-500");
          readyCountRef.current = 0;
        }
      } catch { /* skip frame */ }

      guideLoopRef.current = requestAnimationFrame(detectLoop);
    };

    guideLoopRef.current = requestAnimationFrame(detectLoop);
  }, []);

  // カウントダウン→自動撮影
  const startCountdown = useCallback((detectedLm: Landmark[]) => {
    if (guideLoopRef.current) cancelAnimationFrame(guideLoopRef.current);
    guideLoopRef.current = null;

    if (startGuideForStep.current === "side") {
      speak("そのまま横向きでストップ", true);
    } else {
      speak("そのままの位置でストップ", true);
    }
    setCountdown(5);
    setGuideBorderColor("border-green-500");
    setGuideText("そのまま動かないでください...");

    // ストップ音声の後にカウントダウン開始
    setTimeout(() => {
      let count = 5;
      speak("5", true);

      countdownRef.current = window.setInterval(() => {
        count--;
        if (count > 0) {
          setCountdown(count);
          speak(String(count), true);
        } else {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          setCountdown(null);
          speak("撮影しました", true);
          doCapture(detectedLm);
        }
      }, 1000);
    }, 2000);
  }, []);

  // 実際の撮影処理（2段階対応）
  const doCapture = useCallback((lm: Landmark[]) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const mp = mpModulesRef.current;
    if (!video || !canvas || !mp) return;

    setLoading(true);
    setGuideMode(false);

    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    setLandmarks(lm);
    const drawingUtils = new mp.DrawingUtils(ctx);
    drawingUtils.drawConnectors(lm, POSE_CONNECTIONS.map(([s, e]) => ({ start: s, end: e })), { color: "#00FF00", lineWidth: 2 });
    drawingUtils.drawLandmarks(lm, { color: "#FF0000", fillColor: "#FF0000", radius: 4 });

    const currentStep = captureStepRef.current;

    if (currentStep === "front") {
      // 正面撮影完了
      drawDiagnosisOverlay(ctx, lm, canvas.width, canvas.height);
      const frontResults = analyzeFrontPosture(lm);
      setFrontDiagnosis(frontResults);
      frontDiagnosisRef.current = frontResults;
      setFrontImageData(canvas.toDataURL("image/jpeg", 0.7));
      clearLandmarkBuffer();
      setCaptureStep("side");
      captureStepRef.current = "side";
      setLoading(false);
      // 正面撮影完了 → 横向きへ誘導
      setCaptured(true);
      setGuideText("✅ 正面の撮影が完了しました。次は側面の撮影です。");
      speak("次は側面の写真撮影をしますので横向きにしてください", true);
      setGuideBorderColor("border-blue-500");
      setTimeout(() => {
        startGuideForStep.current = "side";
        startGuide();
      }, 6000);
    } else if (currentStep === "side") {
      // 横向き撮影完了
      drawSideDiagnosisOverlay(ctx, lm, canvas.width, canvas.height);
      const sideResults = analyzeSidePosture(lm);
      setDiagnosis([...frontDiagnosisRef.current, ...sideResults]);
      setCaptureStep("done");
      captureStepRef.current = "done";
      setCaptured(true);
      setLoading(false);
      speak("横向きの撮影が完了しました", true);
      startGuideForStep.current = "front";
    }
  }, [startGuide]);

  // 手動撮影
  const manualCapture = useCallback(() => {
    unlockAudio();
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;
    const mp = mpModulesRef.current;
    if (!video || !canvas || !landmarker || !mp) return;

    if (guideLoopRef.current) cancelAnimationFrame(guideLoopRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    guideLoopRef.current = null;
    countdownRef.current = null;

    setLoading(true);
    setCaptured(true);
    setGuideMode(false);
    setCountdown(null);
    setDiagnosis([]);
    setSaved(false);
    setPhotoSaved(false);

    const ctx = canvas.getContext("2d")!;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // IMAGE modeで再検出
    try {
      // detectForVideoを最新フレームで使用
      const result = landmarker.detectForVideo(video, performance.now());
      if (result.landmarks.length > 0) {
        const lm: Landmark[] = result.landmarks[0];
        setLandmarks(lm);
        const drawingUtils = new mp.DrawingUtils(ctx);
        drawingUtils.drawConnectors(lm, POSE_CONNECTIONS.map(([s, e]) => ({ start: s, end: e })), { color: "#00FF00", lineWidth: 2 });
        drawingUtils.drawLandmarks(lm, { color: "#FF0000", fillColor: "#FF0000", radius: 4 });
        const manualStep = captureStepRef.current;
        if (manualStep === "front") {
          drawDiagnosisOverlay(ctx, lm, canvas.width, canvas.height);
          const frontResults = analyzeFrontPosture(lm);
          setFrontDiagnosis(frontResults);
          frontDiagnosisRef.current = frontResults;
          setFrontImageData(canvas.toDataURL("image/jpeg", 0.7));
          clearLandmarkBuffer();
          setCaptureStep("side");
          captureStepRef.current = "side";
          setCaptured(true);
          setLoading(false);
          setGuideText("✅ 正面の撮影が完了しました。次は側面の撮影です。");
          speak("次は側面の写真撮影をしますので横向きにしてください", true);
          setTimeout(() => {
            startGuideForStep.current = "side";
            startGuide();
          }, 6000);
          return;
        } else if (manualStep === "side") {
          drawSideDiagnosisOverlay(ctx, lm, canvas.width, canvas.height);
          const sideResults = analyzeSidePosture(lm);
          setDiagnosis([...frontDiagnosisRef.current, ...sideResults]);
          setCaptureStep("done");
          captureStepRef.current = "done";
          speak("横向きの撮影が完了しました。チェック結果をご確認ください。", true);
          startGuideForStep.current = "front";
        }
      } else {
        setError("人物が検出されませんでした。全身が映るように撮影してください。");
      }
    } catch (e) {
      console.error("Detection error:", e);
      setError(`解析エラー: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoading(false);
  }, []);

  const handleSave = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || landmarks.length === 0) return;
    const imageData = canvas.toDataURL("image/jpeg", 0.7);
    addRecord(SELF_ID, landmarks, diagnosis, imageData);

    // Supabase Storageに画像をアップロード
    let imageUrl = "";
    try {
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData, deviceId: getDeviceId() }),
      });
      const uploadData = await uploadRes.json();
      if (uploadData.url) imageUrl = uploadData.url;
    } catch { /* アップロード失敗時は空文字で続行 */ }

    saveToDb({ type: "posture", landmarks, diagnosis, imageUrl });
    setSaved(true);
  }, [landmarks, diagnosis]);

  const handleSavePhoto = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `posture-check-${new Date().toISOString().slice(0, 10)}.jpg`;
    link.href = canvas.toDataURL("image/jpeg", 0.9);
    link.click();
    setPhotoSaved(true);
  }, []);

  const reset = useCallback(() => {
    setCaptured(false);
    setDiagnosis([]);
    setLandmarks([]);
    setError(null);
    setSaved(false);
    setPhotoSaved(false);
    setGuideMode(false);
    setCountdown(null);
    setGuideText("スマホを立てかけて、スタートを押してください");
    setGuideBorderColor("border-gray-700");
    setCaptureStep("front");
    captureStepRef.current = "front";
    setFrontDiagnosis([]);
    frontDiagnosisRef.current = [];
    setFrontImageData("");
    clearLandmarkBuffer();
    startGuideForStep.current = "front";
    readyCountRef.current = 0;
    if (guideLoopRef.current) cancelAnimationFrame(guideLoopRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
    guideLoopRef.current = null;
    countdownRef.current = null;
  }, []);

  const levelBg = (l: string) => l === "good" ? "bg-green-900/50 border-green-500" : l === "caution" ? "bg-yellow-900/50 border-yellow-500" : "bg-red-900/50 border-red-500";
  const levelEmoji = (l: string) => l === "good" ? "○" : l === "caution" ? "△" : "✕";

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-2 w-full max-w-md">
        <button onClick={() => { reset(); onNavigate("home"); }} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 戻る</button>
        <h1 className="text-lg font-bold">全身の姿勢チェック</h1>
      </div>
      {/* ステップ表示 */}
      <div className="flex items-center gap-2 mb-4 w-full max-w-md">
        <div className={`flex-1 h-1.5 rounded-full ${captureStep === "front" ? "bg-blue-500" : "bg-green-500"}`} />
        <span className="text-xs text-gray-400">{captureStep === "front" ? "Step 1: 正面" : captureStep === "side" ? "Step 2: 横向き" : "完了"}</span>
        <div className={`flex-1 h-1.5 rounded-full ${captureStep === "done" ? "bg-green-500" : captureStep === "side" ? "bg-blue-500" : "bg-gray-700"}`} />
      </div>

      {initStatus && (
        <div className="bg-blue-900/50 border border-blue-500 text-blue-200 px-4 py-3 rounded mb-4 w-full max-w-md text-center text-sm">{initStatus}</div>
      )}
      {error && (
        <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4 w-full max-w-md text-center text-sm">{error}</div>
      )}

      {/* AIガイドメッセージ */}
      {!captured && cameraReady && (
        <div className={`w-full max-w-md mb-3 px-4 py-3 rounded-lg border-2 ${guideBorderColor} bg-gray-900 text-center`}>
          {countdown !== null ? (
            <p className="text-4xl font-bold text-green-400">{countdown}</p>
          ) : (
            <p className="text-base font-semibold">{guideText}</p>
          )}
        </div>
      )}

      {/* カメラビュー */}
      <div className={`relative w-full max-w-md aspect-[3/4] bg-black rounded-lg overflow-hidden border-2 ${!captured ? guideBorderColor : "border-transparent"}`}>
        <video ref={videoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${captured ? "hidden" : ""}`} />
        <canvas ref={guideCanvasRef} className={`absolute inset-0 w-full h-full ${captured || !guideMode ? "hidden" : ""}`} style={{ pointerEvents: "none" }} />
        <canvas ref={canvasRef} className={`w-full h-full object-cover ${captured ? "" : "hidden"}`} />
        {!cameraReady && !error && (
          <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">カメラを起動中...</div>
        )}
      </div>

      {/* ボタン */}
      <div className="flex gap-3 mt-4 w-full max-w-md">
        {!captured ? (
          <>
            {!guideMode ? (
              <>
                <button onClick={startGuide} disabled={!cameraReady || !modelReady} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 rounded-lg font-semibold">
                  AIガイドで撮影
                </button>
                <button onClick={manualCapture} disabled={!cameraReady || !modelReady || loading} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-lg font-semibold text-sm">
                  手動で撮影
                </button>
              </>
            ) : (
              <button onClick={manualCapture} disabled={loading} className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold">
                今すぐ撮影
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={reset} className="flex-1 px-4 py-3 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold text-sm">もう一度</button>
            {diagnosis.length > 0 && !saved && (
              <button onClick={handleSave} className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold text-sm">アプリに保存</button>
            )}
            {diagnosis.length > 0 && (
              <button onClick={handleSavePhoto} className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 rounded-lg font-semibold text-sm">
                {photoSaved ? "保存済み" : "写真に保存"}
              </button>
            )}
          </>
        )}
      </div>

      {saved && <p className="text-green-400 mt-2 text-sm">アプリに保存しました</p>}
      {photoSaved && <p className="text-orange-400 mt-1 text-sm">写真をダウンロードしました</p>}

      {saved && (
        <button onClick={() => onNavigate("history")} className="mt-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold text-sm">
          履歴を見る
        </button>
      )}

      {diagnosis.length > 0 && (
        <div className="w-full max-w-md mt-4 space-y-4">
          {/* 正面のチェック結果（最初の5項目） */}
          <div>
            <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
              <span className="px-2 py-0.5 bg-blue-600 rounded text-xs">正面</span>
              正面からのチェック
            </h2>
            <div className="space-y-2">
              {diagnosis.slice(0, 5).map((item, i) => (
                <div key={i} className={`border rounded-lg px-4 py-3 ${levelBg(item.level)}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold">{item.label}</span>
                    <span className="text-sm">{levelEmoji(item.level)} {item.value}{item.unit}</span>
                  </div>
                  <p className="text-sm opacity-80 mb-1">{item.message}</p>
                  <p className="text-xs opacity-60">{item.advice}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 側面のチェック結果（6項目目以降） */}
          {diagnosis.length > 5 && (
            <div>
              <h2 className="text-lg font-bold mb-2 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-purple-600 rounded text-xs">側面</span>
                横からのチェック
              </h2>
              <div className="space-y-2">
                {diagnosis.slice(5).map((item, i) => (
                  <div key={i} className={`border rounded-lg px-4 py-3 ${levelBg(item.level)}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{item.label}</span>
                      <span className="text-sm">{levelEmoji(item.level)} {item.value}{item.unit}</span>
                    </div>
                    <p className="text-sm opacity-80 mb-1">{item.message}</p>
                    <p className="text-xs opacity-60">{item.advice}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

// ==================== 履歴画面 ====================
function HistoryScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [records, setRecords] = useState<PostureRecord[]>([]);
  const [compareIds, setCompareIds] = useState<[string | null, string | null]>([null, null]);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    setRecords(getRecords(SELF_ID));
  }, []);

  const toggleSelect = (id: string) => {
    if (compareIds[0] === id) setCompareIds([compareIds[1], null]);
    else if (compareIds[1] === id) setCompareIds([compareIds[0], null]);
    else if (!compareIds[0]) setCompareIds([id, compareIds[1]]);
    else if (!compareIds[1]) setCompareIds([compareIds[0], id]);
  };

  const handleDelete = (id: string) => {
    deleteRecord(id);
    setRecords(records.filter((r) => r.id !== id));
    if (compareIds[0] === id) setCompareIds([compareIds[1], null]);
    if (compareIds[1] === id) setCompareIds([compareIds[0], null]);
  };

  const record1 = records.find((r) => r.id === compareIds[0]);
  const record2 = records.find((r) => r.id === compareIds[1]);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, "0")}`;
  };

  const levelColor = (l: string) => l === "good" ? "text-green-400" : l === "caution" ? "text-yellow-400" : "text-red-400";

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-lg">
        <button onClick={() => onNavigate("home")} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 戻る</button>
        <h1 className="text-lg font-bold">過去の記録</h1>
      </div>

      {records.length === 0 ? (
        <p className="text-gray-500 text-center py-8">まだ記録がありません</p>
      ) : !comparing ? (
        <>
          <p className="text-gray-400 text-sm mb-3">ビフォーアフターを比較するには2つの記録を選んでください</p>
          <div className="w-full max-w-lg space-y-3">
            {records.map((record) => {
              const isSelected = compareIds.includes(record.id);
              return (
                <div key={record.id} className={`border rounded-lg overflow-hidden ${isSelected ? "border-blue-500" : "border-gray-700"}`}>
                  <button onClick={() => toggleSelect(record.id)} className="w-full flex items-center gap-3 p-3 bg-gray-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={record.imageDataUrl} alt="撮影写真" className="w-16 h-20 object-cover rounded" />
                    <div className="flex-1 text-left">
                      <p className="font-semibold">{formatDate(record.date)}</p>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {record.diagnosis.map((d, i) => (
                          <span key={i} className={`text-xs ${levelColor(d.level)}`}>{d.label}: {d.value}{d.unit}</span>
                        ))}
                      </div>
                    </div>
                    {isSelected && <span className="text-blue-400 text-xs">選択中</span>}
                  </button>
                  <div className="flex border-t border-gray-700">
                    <button onClick={() => handleDelete(record.id)} className="flex-1 py-1 text-red-400 text-xs hover:bg-red-900/30">削除</button>
                  </div>
                </div>
              );
            })}
          </div>
          {compareIds[0] && compareIds[1] && (
            <button onClick={() => setComparing(true)} className="mt-4 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold">
              ビフォーアフター比較
            </button>
          )}
        </>
      ) : (
        <div className="w-full max-w-lg">
          <button onClick={() => setComparing(false)} className="mb-4 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 一覧に戻る</button>
          <div className="flex gap-2 mb-4">
            <div className="flex-1">
              <p className="text-center text-sm text-gray-400 mb-1">Before ({record1 && formatDate(record1.date)})</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {record1 && <img src={record1.imageDataUrl} alt="Before" className="w-full rounded-lg" />}
            </div>
            <div className="flex-1">
              <p className="text-center text-sm text-gray-400 mb-1">After ({record2 && formatDate(record2.date)})</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {record2 && <img src={record2.imageDataUrl} alt="After" className="w-full rounded-lg" />}
            </div>
          </div>
          {record1 && record2 && (
            <div className="space-y-2">
              <h2 className="text-lg font-bold">変化の比較</h2>
              {record1.diagnosis.map((before, i) => {
                const after = record2.diagnosis[i];
                if (!after) return null;
                const diff = after.value - before.value;
                const improved = Math.abs(after.value) < Math.abs(before.value);
                return (
                  <div key={i} className="bg-gray-800 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold">{before.label}</span>
                      <span className={improved ? "text-green-400 text-sm" : diff === 0 ? "text-gray-400 text-sm" : "text-red-400 text-sm"}>
                        {improved ? "改善" : diff === 0 ? "変化なし" : "悪化"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={levelColor(before.level)}>{before.value}{before.unit}</span>
                      <span className="text-gray-500">→</span>
                      <span className={levelColor(after.level)}>{after.value}{after.unit}</span>
                      <span className="text-gray-500 ml-auto">({diff > 0 ? "+" : ""}{diff.toFixed(1)}{before.unit})</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button onClick={() => onNavigate("check")} className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold">
        新しく撮影する
      </button>
    </main>
  );
}

// ==================== 今日のガイコツ先生の一言 ====================
function DailyTipCard() {
  const [tip, setTip] = useState<{ emoji: string; title: string; body: string } | null>(null);

  useEffect(() => {
    fetch("/api/daily-tip")
      .then((r) => r.json())
      .then((d) => {
        if (d.tip) setTip(d.tip);
      })
      .catch(() => {});
  }, []);

  if (!tip) return null;

  return (
    <div className="card-base p-4 relative overflow-hidden">
      <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/70" />
      <div className="flex items-start gap-3 pl-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-skeleton-sensei-face.png"
          alt="ガイコツ先生"
          className="w-12 h-12 object-contain flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-[11px] text-amber-400 font-bold mb-1 tracking-wide">
            🌱 今日の一言
          </p>
          <p className="text-base font-bold text-white mb-1.5 flex items-center gap-1.5 leading-tight">
            <span className="text-xl">{tip.emoji}</span>
            <span>{tip.title}</span>
          </p>
          <p className="text-sm text-gray-300 leading-relaxed">{tip.body}</p>
        </div>
      </div>
    </div>
  );
}

// ==================== PFC バランス円グラフ ====================
function PFCCircleChart({
  protein,
  carbs,
  fat,
  size = 80,
}: {
  protein: number;
  carbs: number;
  fat: number;
  size?: number;
}) {
  // PFCをカロリー換算（タンパク質4/炭水化物4/脂質9 kcal/g）
  const pCal = protein * 4;
  const cCal = carbs * 4;
  const fCal = fat * 9;
  const total = pCal + cCal + fCal;

  if (total === 0) {
    return (
      <div
        className="rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <span className="text-[11px] text-gray-500 text-center leading-tight">
          PFC
          <br />
          データ
          <br />
          なし
        </span>
      </div>
    );
  }

  const pRatio = pCal / total;
  const cRatio = cCal / total;
  const fRatio = fCal / total;

  // 円グラフのセグメントを計算
  const radius = size / 2 - 2;
  const circumference = 2 * Math.PI * radius;

  const pLen = pRatio * circumference;
  const cLen = cRatio * circumference;
  const fLen = fRatio * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* 背景 */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#1f2937"
          strokeWidth="6"
          fill="none"
        />
        {/* タンパク質（緑） */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#10b981"
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${pLen} ${circumference - pLen}`}
          strokeLinecap="butt"
        />
        {/* 炭水化物（黄） */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f59e0b"
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${cLen} ${circumference - cLen}`}
          strokeDashoffset={-pLen}
          strokeLinecap="butt"
        />
        {/* 脂質（赤） */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#f43f5e"
          strokeWidth="6"
          fill="none"
          strokeDasharray={`${fLen} ${circumference - fLen}`}
          strokeDashoffset={-(pLen + cLen)}
          strokeLinecap="butt"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[11px] text-gray-400 leading-none">PFC</span>
        <span className="text-[11px] font-bold text-white leading-none mt-0.5">
          {Math.round(pRatio * 100)}:{Math.round(cRatio * 100)}:{Math.round(fRatio * 100)}
        </span>
      </div>
    </div>
  );
}

// ==================== 今日の食事ダッシュボード（ホーム画面用） ====================
type TodayMealType = "朝食" | "昼食" | "夕食" | "間食";
interface TodayDataShape {
  date: string;
  byMealType: Record<
    string,
    {
      meals: Array<{
        id: string;
        image_url: string;
        menu_name: string | null;
        calories: number | null;
      }>;
      totals: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
    }
  >;
  total: { calories: number; protein_g: number; carbs_g: number; fat_g: number };
  goal: {
    target_calories: number;
    target_protein_g: number;
    target_carbs_g: number | null;
    target_fat_g: number | null;
  } | null;
}

function TodayMealDashboard({
  onGoToMealMode,
  onOpenMeal,
}: {
  onGoToMealMode: (mode: "home" | "goal" | "calendar") => void;
  onOpenMeal: () => void;
}) {
  const today = new Date();
  const [selectedDateOffset, setSelectedDateOffset] = useState(0); // 0=今日、-1=昨日、+1=明日
  const [data, setData] = useState<TodayDataShape | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + selectedDateOffset);
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDateOffset]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const deviceId = getDeviceId();
        const y = selectedDate.getFullYear();
        const m = String(selectedDate.getMonth() + 1).padStart(2, "0");
        const d = String(selectedDate.getDate()).padStart(2, "0");
        const res = await fetch(
          `/api/meal/today?deviceId=${encodeURIComponent(deviceId || "")}&date=${y}-${m}-${d}`
        );
        const json = await res.json();
        if (res.ok) setData(json);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedDate]);

  // 7日分のカレンダー（今日を中心に±3日）
  const weekDays = useMemo(() => {
    const days: Array<{ date: Date; offset: number }> = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      days.push({ date: d, offset: i });
    }
    return days;
    // 今日は起動時の固定値でOK
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const goal = data?.goal;
  const totalCal = data?.total.calories || 0;
  const targetCal = goal?.target_calories || 0;
  const calProgress = targetCal > 0 ? Math.min(100, (totalCal / targetCal) * 100) : 0;

  const mealTypes: Array<{ key: TodayMealType; emoji: string; color: string }> = [
    { key: "朝食", emoji: "🌅", color: "amber" },
    { key: "昼食", emoji: "☀️", color: "yellow" },
    { key: "夕食", emoji: "🌙", color: "indigo" },
    { key: "間食", emoji: "🍩", color: "pink" },
  ];

  const dayLabels = ["日", "月", "火", "水", "木", "金", "土"];

  return (
    <div className="card-accent-emerald p-4 space-y-3 relative overflow-hidden">
      {/* 週間カレンダー（横7日分） */}
      <div className="flex items-center justify-between gap-1">
        {weekDays.map((d) => {
          const isSelected = d.offset === selectedDateOffset;
          const isToday = d.offset === 0;
          const dayOfWeek = dayLabels[d.date.getDay()];
          return (
            <button
              key={d.offset}
              onClick={() => setSelectedDateOffset(d.offset)}
              className={`flex-1 py-2 rounded-xl transition ${
                isSelected
                  ? "bg-emerald-500 text-white"
                  : isToday
                  ? "bg-emerald-500/20 border border-emerald-500/40 text-emerald-300"
                  : "text-gray-400"
              }`}
            >
              <p className="text-[11px] font-semibold">{isToday ? "今日" : dayOfWeek}</p>
              <p className="text-sm font-extrabold">{d.date.getDate()}</p>
            </button>
          );
        })}
      </div>

      {/* 摂取カロリー プログレスバー + PFC円グラフ */}
      <div className="bg-gray-900/50 rounded-xl p-3 grid grid-cols-[auto_1fr] gap-3 items-center">
        {/* 左: PFC円グラフ */}
        <PFCCircleChart
          protein={data?.total.protein_g || 0}
          carbs={data?.total.carbs_g || 0}
          fat={data?.total.fat_g || 0}
          size={80}
        />
        {/* 右: カロリー + PFC数値 */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] text-gray-400">摂取カロリー</p>
            {targetCal > 0 ? (
              <p className="text-[11px] text-gray-400">目標 {targetCal}kcal</p>
            ) : (
              <button
                onClick={() => onGoToMealMode("goal")}
                className="text-[11px] text-indigo-400 font-bold"
              >
                目標を設定 →
              </button>
            )}
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-300 leading-none">{totalCal}</span>
            <span className="text-[11px] text-gray-400">kcal</span>
          </div>
          {targetCal > 0 && (
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    calProgress > 110
                      ? "bg-red-500"
                      : calProgress >= 90
                      ? "bg-emerald-500"
                      : "bg-blue-500"
                  }`}
                  style={{ width: `${calProgress}%` }}
                />
              </div>
              <span className="text-[11px] text-gray-400 whitespace-nowrap">
                {Math.round(calProgress)}%
              </span>
            </div>
          )}
          {/* PFC各数値 */}
          <div className="flex items-center gap-2 text-[11px] pt-0.5">
            <span className="text-emerald-400 font-bold">
              P {Math.round(data?.total.protein_g || 0)}g
            </span>
            <span className="text-amber-400 font-bold">
              C {Math.round(data?.total.carbs_g || 0)}g
            </span>
            <span className="text-rose-400 font-bold">
              F {Math.round(data?.total.fat_g || 0)}g
            </span>
          </div>
        </div>
      </div>

      {/* 食事区分別サマリ（4つの枠） */}
      <div className="grid grid-cols-2 gap-2">
        {mealTypes.map(({ key, emoji }) => {
          const m = data?.byMealType[key];
          const recorded = (m?.meals.length || 0) > 0;
          const kcal = m?.totals.calories || 0;
          return (
            <button
              key={key}
              onClick={onOpenMeal}
              className={`rounded-xl px-3 py-2.5 text-left transition ${
                recorded
                  ? "bg-gray-900 border border-emerald-500/30"
                  : "bg-gray-900/50 border border-gray-800 border-dashed"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-lg">{emoji}</span>
                {recorded ? (
                  <span className="text-[11px] text-emerald-400 font-bold">✓ 記録済</span>
                ) : (
                  <span className="text-[11px] text-gray-500">未記録</span>
                )}
              </div>
              <p className="text-xs font-bold text-gray-300">{key}</p>
              {recorded ? (
                <p className="text-xs text-gray-400 mt-0.5">{kcal} kcal</p>
              ) : (
                <p className="text-[11px] text-gray-500 mt-0.5">タップで撮影</p>
              )}
            </button>
          );
        })}
      </div>

      {loading && (
        <p className="text-[11px] text-center text-gray-500">読み込み中...</p>
      )}
    </div>
  );
}

// ==================== 食事記録画面 ====================
type MealAnalysis = {
  menu_name?: string;
  meal_type?: string;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  advice?: string;
  score?: number;
};

type MealRecord = {
  id: string;
  image_url: string;
  meal_type: string | null;
  menu_name: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  advice: string | null;
  score: number | null;
  created_at: string;
};

// 画像を512pxに圧縮してbase64で返す（コスト削減のため）
// iPhone HEIC自動変換（多段階フォールバック: ネイティブ→heic-to→heic2any）
async function compressImageToBase64(input: File, maxSize = 512): Promise<string> {
  let file: Blob = input;
  const nameLower = input.name.toLowerCase();
  const typeLower = (input.type || "").toLowerCase();
  const isHeic =
    nameLower.endsWith(".heic") ||
    nameLower.endsWith(".heif") ||
    typeLower.includes("heic") ||
    typeLower.includes("heif");

  // HEIC / HEIF は複数方式でJPEGへ変換を試行
  if (isHeic) {
    let converted: Blob | null = null;
    const errors: string[] = [];

    // 方式1: Safari等のネイティブサポートを試す（createImageBitmap→canvas）
    try {
      const bitmap = await createImageBitmap(input);
      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(bitmap, 0, 0);
        bitmap.close?.();
        converted = await new Promise<Blob | null>((r) =>
          canvas.toBlob((b) => r(b), "image/jpeg", 0.9)
        );
      }
    } catch (err) {
      errors.push(`native: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 方式2: heic-to（モダンで軽量）
    if (!converted) {
      try {
        const heicToModule = await import("heic-to");
        const result = await heicToModule.heicTo({
          blob: input,
          type: "image/jpeg",
          quality: 0.9,
        });
        converted = result as Blob;
      } catch (err) {
        errors.push(`heic-to: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // 方式3: heic2any（旧実装・最終フォールバック）
    if (!converted) {
      try {
        const heic2anyModule = await import("heic2any");
        const result = await heic2anyModule.default({
          blob: input,
          toType: "image/jpeg",
          quality: 0.9,
        });
        converted = Array.isArray(result) ? result[0] : (result as Blob);
      } catch (err) {
        errors.push(`heic2any: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (!converted) {
      console.error("HEIC conversion failed:", errors);
      throw new Error(
        `HEIC写真の変換に失敗しました。JPEG形式の写真をお試しください。\n詳細: ${errors.join(" / ")}`
      );
    }

    file = converted;
  }

  // まず createImageBitmap で試す（最も高速で多くの形式に対応）
  try {
    const bitmap = await createImageBitmap(file);
    let { width, height } = bitmap;
    if (width > height) {
      if (width > maxSize) {
        height = Math.round((height * maxSize) / width);
        width = maxSize;
      }
    } else {
      if (height > maxSize) {
        width = Math.round((width * maxSize) / height);
        height = maxSize;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas context not available");
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close?.();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    // フォールバック: URL.createObjectURL + HTMLImageElement
    return new Promise<string>((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = document.createElement("img");
      img.onload = () => {
        try {
          let { naturalWidth: width, naturalHeight: height } = img;
          if (!width || !height) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("画像の読み込みに失敗しました（サイズ取得不可）"));
            return;
          }
          if (width > height) {
            if (width > maxSize) {
              height = Math.round((height * maxSize) / width);
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width = Math.round((width * maxSize) / height);
              height = maxSize;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("canvas contextが取得できません"));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(objectUrl);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } catch (err) {
          URL.revokeObjectURL(objectUrl);
          reject(err instanceof Error ? err : new Error("画像圧縮に失敗しました"));
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(
          new Error(
            "画像を読み込めませんでした。JPEG/PNG形式の写真をお試しください。"
          )
        );
      };
      img.src = objectUrl;
    });
  }
}

type MySet = {
  id: string;
  name: string;
  meal_type: string | null;
  menu_name: string;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  icon: string | null;
  use_count: number;
  last_used_at: string | null;
};

function MealScreen({
  onNavigate,
  initialMode,
  onModeConsumed,
}: {
  onNavigate: (s: Screen) => void;
  initialMode?: "home" | "goal" | "calendar" | null;
  onModeConsumed?: () => void;
}) {
  const [mode, setMode] = useState<"home" | "analyzing" | "result" | "history" | "calendar" | "goal">(
    initialMode === "goal" || initialMode === "calendar" ? initialMode : "home"
  );
  const [selectedMealType, setSelectedMealType] = useState<"朝食" | "昼食" | "夕食" | "間食">(
    () => {
      // 時刻に応じた初期値
      const h = new Date().getHours();
      if (h >= 4 && h < 10) return "朝食";
      if (h >= 10 && h < 15) return "昼食";
      if (h >= 15 && h < 22) return "夕食";
      return "間食";
    }
  );
  const [mySets, setMySets] = useState<MySet[]>([]);
  const [savingSet, setSavingSet] = useState(false);
  const [showSaveSetModal, setShowSaveSetModal] = useState(false);

  // 画面表示後にinitialModeを消費（戻ったときにhomeに戻るように）
  useEffect(() => {
    if (initialMode && onModeConsumed) {
      onModeConsumed();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [analysisImageUrl, setAnalysisImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<MealRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMode("analyzing");
    try {
      // 圧縮してbase64化（パッケージの文字/ラベルを読み取るため768pxに）
      const compressedDataUrl = await compressImageToBase64(file, 768);
      setPreviewUrl(compressedDataUrl);

      const deviceId = getDeviceId();
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageData: compressedDataUrl,
          deviceId,
          mealType: selectedMealType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402 && data.error === "limit_reached") {
          throw new Error(`__LIMIT_REACHED__${data.message || "無料プランの上限に達しました"}`);
        }
        const detail = data.detail ? `\n詳細: ${data.detail}` : "";
        throw new Error(`${data.error || "分析に失敗しました"}${detail}`);
      }
      setAnalysis(data.analysis);
      setAnalysisImageUrl(data.imageUrl);
      setMode("result");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setMode("home");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const openHistory = async () => {
    setMode("history");
    setLoadingHistory(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/meal?deviceId=${encodeURIComponent(deviceId || "")}`);
      const data = await res.json();
      setRecords(data.records || []);
    } catch {
      setRecords([]);
    } finally {
      setLoadingHistory(false);
    }
  };

  // MYセット一覧読み込み
  const loadMySets = useCallback(async () => {
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/meal/my-sets?deviceId=${encodeURIComponent(deviceId || "")}`
      );
      const data = await res.json();
      setMySets(data.sets || []);
    } catch {
      setMySets([]);
    }
  }, []);

  useEffect(() => {
    if (mode === "home") loadMySets();
  }, [mode, loadMySets]);

  // MYセットから1タップ記録
  const useMySet = async (setId: string) => {
    try {
      const res = await fetch("/api/meal/my-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "use",
          deviceId: getDeviceId(),
          setId,
          mealType: selectedMealType,
        }),
      });
      if (!res.ok) throw new Error("MYセットの記録に失敗しました");
      await loadMySets();
      alert(`✅ ${selectedMealType}として記録しました！`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "記録失敗");
    }
  };

  // 今の分析結果をMYセットとして保存
  const saveAsMySet = async (name: string, icon: string) => {
    if (!analysis || !name.trim()) return;
    setSavingSet(true);
    try {
      const res = await fetch("/api/meal/my-sets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          deviceId: getDeviceId(),
          name: name.trim(),
          mealType: analysis.meal_type || selectedMealType,
          menuName: analysis.menu_name || "名称不明",
          calories: analysis.calories,
          proteinG: analysis.protein_g,
          carbsG: analysis.carbs_g,
          fatG: analysis.fat_g,
          icon,
        }),
      });
      if (!res.ok) throw new Error("MYセット保存失敗");
      setShowSaveSetModal(false);
      await loadMySets();
      alert(`✅「${name}」をMYセットに保存しました`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存失敗");
    } finally {
      setSavingSet(false);
    }
  };

  const resetToHome = () => {
    setMode("home");
    setPreviewUrl(null);
    setAnalysis(null);
    setAnalysisImageUrl(null);
    setError(null);
  };

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">🍱 食事記録＆ガイコツ先生の分析</h1>
      </div>

      {/* ホーム（撮影ボタン） */}
      {mode === "home" && (
        <div className="w-full max-w-md space-y-4">
          <div className="card-accent-emerald p-5">
            <p className="text-sm text-emerald-100 leading-relaxed">
              📸 食事の写真を撮るだけで、ガイコツ先生がメニュー・カロリー・栄養バランスを分析し、あなたの姿勢や痛みに合わせたアドバイスをお伝えします。
            </p>
          </div>

          {error && !error.startsWith("__LIMIT_REACHED__") && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-300">
              ⚠️ {error}
            </div>
          )}
          {error && error.startsWith("__LIMIT_REACHED__") && (
            <div className="bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border border-amber-500/40 rounded-2xl px-4 py-4 space-y-3">
              <p className="text-sm text-amber-200">
                🎁 {error.replace("__LIMIT_REACHED__", "")}
              </p>
              <button
                onClick={() => onNavigate("subscription")}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-600 rounded-xl text-sm font-bold"
              >
                👑 プラン画面を開く
              </button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* 食事区分の選択（撮影前に必ず選ぶ） */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
            <p className="text-xs text-gray-400 mb-2.5">📍 どの食事を記録しますか？</p>
            <div className="grid grid-cols-4 gap-2">
              {(
                [
                  { type: "朝食", emoji: "🌅", color: "amber" },
                  { type: "昼食", emoji: "☀️", color: "yellow" },
                  { type: "夕食", emoji: "🌙", color: "indigo" },
                  { type: "間食", emoji: "🍩", color: "pink" },
                ] as const
              ).map(({ type, emoji }) => (
                <button
                  key={type}
                  onClick={() => setSelectedMealType(type)}
                  className={`py-2.5 rounded-xl font-bold flex flex-col items-center gap-0.5 border-2 transition ${
                    selectedMealType === type
                      ? "bg-emerald-600 border-emerald-400 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-400"
                  }`}
                >
                  <span className="text-xl">{emoji}</span>
                  <span className="text-xs">{type}</span>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-primary w-full px-5 py-6 flex items-center justify-center gap-3"
          >
            <span className="text-3xl">📷</span>
            <span className="text-lg font-bold">{selectedMealType}を撮影する</span>
          </button>

          {/* プロフィール & 目標（重要） */}
          <button
            onClick={() => setMode("goal")}
            className="btn-secondary w-full px-5 py-4 flex items-center gap-3"
          >
            <span className="text-3xl">👤</span>
            <div className="text-left flex-1">
              <p className="text-base font-bold">プロフィール &amp; 目標</p>
              <p className="text-sm text-indigo-100 mt-0.5">身長・体重から最適プラン計算</p>
            </div>
            <span className="text-white/70 text-xl">›</span>
          </button>

          {/* カレンダー・履歴はニュートラル */}
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("calendar")}
              className="btn-neutral px-3 py-4 flex flex-col items-center gap-1"
            >
              <span className="text-2xl">📅</span>
              <p className="text-sm font-bold">カレンダー</p>
              <p className="text-[11px] text-gray-400 text-center leading-tight">日別カロリー推移</p>
            </button>

            <button
              onClick={openHistory}
              className="btn-neutral px-3 py-4 flex flex-col items-center gap-1"
            >
              <span className="text-2xl">📚</span>
              <p className="text-sm font-bold">履歴</p>
              <p className="text-[11px] text-gray-400 text-center leading-tight">全記録を一覧で確認</p>
            </button>
          </div>

          {/* MYセット（1タップで記録） */}
          {mySets.length > 0 && (
            <div className="card-base p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold text-amber-400">⭐ MYセット（1タップ記録）</p>
                <p className="text-[11px] text-gray-400">
                  {selectedMealType}として記録
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {mySets.slice(0, 6).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => useMySet(s.id)}
                    className="btn-neutral px-3 py-2.5 text-left active:scale-95 transition"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{s.icon || "🍽️"}</span>
                      <p className="text-xs font-bold truncate">{s.name}</p>
                    </div>
                    <p className="text-[11px] text-gray-400 truncate">{s.menu_name}</p>
                    <p className="text-[11px] text-emerald-400 font-bold">
                      {s.calories || "-"}kcal / P{s.protein_g || 0}g
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* カレンダーモード */}
      {mode === "calendar" && (
        <MealCalendarView onBack={() => setMode("home")} />
      )}

      {/* 目標設定モード */}
      {mode === "goal" && (
        <MealGoalView onBack={() => setMode("home")} />
      )}

      {/* 分析中 */}
      {mode === "analyzing" && (
        <div className="w-full max-w-md space-y-4 text-center">
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="分析中"
              className="w-full aspect-square object-cover rounded-2xl"
            />
          )}
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5">
            <div className="flex items-center justify-center gap-3 mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                className="w-14 h-14 object-contain animate-pulse"
              />
              <span className="animate-pulse text-emerald-300 text-lg font-bold">
                ガイコツ先生が分析中...
              </span>
            </div>
            <p className="text-xs text-gray-400">
              メニュー識別 → 栄養素計算 → あなた専用のアドバイス生成中
            </p>
          </div>
        </div>
      )}

      {/* 結果表示 */}
      {mode === "result" && analysis && (
        <div className="w-full max-w-md space-y-4">
          {analysisImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={analysisImageUrl}
              alt={analysis.menu_name || "食事写真"}
              className="w-full aspect-square object-cover rounded-2xl"
            />
          )}

          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">ガイコツ先生の推定</span>
              {analysis.meal_type && (
                <span className="text-xs px-2 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full">
                  {analysis.meal_type}
                </span>
              )}
            </div>
            <p className="text-lg font-bold">{analysis.menu_name || "判定不能"}</p>
            {typeof analysis.score === "number" && (
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500"
                    style={{ width: `${Math.max(0, Math.min(100, analysis.score))}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-emerald-300">
                  {analysis.score}/100
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <NutritionCell label="カロリー" value={analysis.calories} unit="kcal" />
            <NutritionCell label="タンパク質" value={analysis.protein_g} unit="g" />
            <NutritionCell label="炭水化物" value={analysis.carbs_g} unit="g" />
            <NutritionCell label="脂質" value={analysis.fat_g} unit="g" />
          </div>

          {analysis.advice && (
            <div className="card-accent-indigo p-4">
              <p className="text-xs text-indigo-300 mb-2 font-bold">💬 ガイコツ先生より</p>
              <p className="text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                {analysis.advice}
              </p>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={resetToHome}
              className="btn-neutral flex-1 px-4 py-3 text-sm"
            >
              もう1枚撮る
            </button>
            <button
              onClick={() => onNavigate("home")}
              className="btn-primary flex-1 px-4 py-3 text-sm"
            >
              ホームへ
            </button>
          </div>

          {/* MYセットに保存ボタン */}
          <button
            onClick={() => setShowSaveSetModal(true)}
            className="card-accent-amber w-full px-4 py-3 text-sm font-bold text-amber-300 flex items-center justify-center gap-2 transition active:scale-[0.99]"
          >
            ⭐ この食事をMYセットに保存
          </button>
        </div>
      )}

      {/* MYセット保存モーダル */}
      {showSaveSetModal && analysis && (
        <SaveMySetModal
          analysis={analysis}
          saving={savingSet}
          onSave={saveAsMySet}
          onClose={() => setShowSaveSetModal(false)}
        />
      )}

      {/* 履歴 */}
      {mode === "history" && (
        <div className="w-full max-w-md space-y-3">
          <button
            onClick={resetToHome}
            className="text-xs text-emerald-400"
          >
            ← 撮影画面に戻る
          </button>

          {loadingHistory ? (
            <div className="text-center text-gray-400 py-10">読み込み中...</div>
          ) : records.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              まだ記録がありません。食事を撮影してみましょう！
            </div>
          ) : (
            records.map((r) => (
              <div
                key={r.id}
                className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={r.image_url}
                  alt={r.menu_name || "食事写真"}
                  className="w-full aspect-video object-cover"
                />
                <div className="p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-gray-500">
                      {new Date(r.created_at).toLocaleString("ja-JP", {
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                    {r.meal_type && (
                      <span className="text-[11px] px-2 py-0.5 bg-emerald-600/30 text-emerald-300 rounded-full">
                        {r.meal_type}
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold">{r.menu_name || "判定不能"}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-gray-400">
                    {r.calories !== null && <span>🔥 {r.calories}kcal</span>}
                    {r.protein_g !== null && <span>P {r.protein_g}g</span>}
                    {r.carbs_g !== null && <span>C {r.carbs_g}g</span>}
                    {r.fat_g !== null && <span>F {r.fat_g}g</span>}
                    {r.score !== null && <span>⭐ {r.score}/100</span>}
                  </div>
                  {r.advice && (
                    <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed mt-2">
                      {r.advice}
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </main>
  );
}

function NutritionCell({
  label,
  value,
  unit,
}: {
  label: string;
  value: number | null | undefined;
  unit: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-2 py-2 text-center">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-white mt-0.5">
        {value !== null && value !== undefined ? value : "-"}
        <span className="text-[11px] font-normal text-gray-400 ml-0.5">{unit}</span>
      </p>
    </div>
  );
}

// ==================== 食事カレンダー ====================
type CalendarMeal = {
  id: string;
  image_url: string;
  menu_name: string | null;
  meal_type: string | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  advice: string | null;
  score: number | null;
  created_at: string;
};

type CalendarDayData = {
  meals: CalendarMeal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  avgScore: number;
};

type CalendarGoal = {
  goal_type: string;
  target_calories: number;
  target_protein_g: number;
};

type CalendarData = {
  year: number;
  month: number;
  days: Record<string, CalendarDayData>;
  stats: {
    recordedDays: number;
    totalMeals: number;
    avgCalPerDay: number;
    avgProteinPerDay: number;
  } | null;
  goal: CalendarGoal | null;
};

function MealCalendarView({ onBack }: { onBack: () => void }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData] = useState<CalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/meal/calendar?deviceId=${encodeURIComponent(deviceId || "")}&year=${year}&month=${month}`
      );
      const d = await res.json();
      if (res.ok) setData(d);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    setSelectedDay(null);
  };
  const nextMonth = () => {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    }
    setMonth(newMonth);
    setYear(newYear);
    setSelectedDay(null);
  };

  // カレンダーのマス目計算
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=日
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: Array<{ day: number | null }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d });
  while (cells.length % 7 !== 0) cells.push({ day: null });

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() + 1 === month && today.getDate() === d;

  const getDayData = (d: number) => data?.days[String(d)];

  const targetCal = data?.goal?.target_calories;

  const colorForCalories = (cal: number): string => {
    if (!targetCal) return "bg-emerald-500/40";
    const ratio = cal / targetCal;
    if (ratio < 0.5) return "bg-blue-500/40";
    if (ratio <= 1.1) return "bg-emerald-500/50";
    if (ratio <= 1.3) return "bg-amber-500/50";
    return "bg-red-500/50";
  };

  const selectedDayData = selectedDay ? getDayData(selectedDay) : null;

  return (
    <div className="w-full max-w-md space-y-3">
      <button
        onClick={onBack}
        className="text-xs text-emerald-400"
      >
        ← 食事メニューに戻る
      </button>

      {/* 月切り替え */}
      <div className="flex items-center justify-between bg-gray-900 border border-gray-800 rounded-2xl px-4 py-3">
        <button onClick={prevMonth} className="text-xl px-3">‹</button>
        <p className="text-base font-bold">
          {year}年 {month}月
        </p>
        <button onClick={nextMonth} className="text-xl px-3">›</button>
      </div>

      {loading && <div className="text-center text-gray-400 py-8">読み込み中...</div>}

      {/* 統計カード */}
      {data?.stats && data.stats.recordedDays > 0 && (
        <div className="bg-gradient-to-br from-emerald-500/10 to-green-600/5 border border-emerald-500/30 rounded-2xl p-4">
          <p className="text-xs text-emerald-300 mb-2">📊 今月の記録</p>
          <div className="grid grid-cols-2 gap-3">
            <StatCell label="記録日数" value={`${data.stats.recordedDays}日`} />
            <StatCell label="記録食事" value={`${data.stats.totalMeals}件`} />
            <StatCell label="1日平均" value={`${data.stats.avgCalPerDay}kcal`} />
            <StatCell label="タンパク質/日" value={`${data.stats.avgProteinPerDay}g`} />
          </div>
          {data.goal && (
            <p className="text-[11px] text-gray-400 mt-2">
              🎯 目標: {data.goal.target_calories}kcal / タンパク質{data.goal.target_protein_g}g
            </p>
          )}
        </div>
      )}

      {/* カレンダーグリッド */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-3">
        <div className="grid grid-cols-7 gap-1 mb-2">
          {["日", "月", "火", "水", "木", "金", "土"].map((d, i) => (
            <p
              key={d}
              className={`text-center text-[11px] font-bold ${
                i === 0 ? "text-red-400" : i === 6 ? "text-blue-400" : "text-gray-400"
              }`}
            >
              {d}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((c, i) => {
            if (c.day === null) return <div key={i} className="aspect-square" />;
            const dayData = getDayData(c.day);
            const hasData = !!dayData;
            const cal = dayData?.totalCalories || 0;
            const isSel = selectedDay === c.day;
            return (
              <button
                key={i}
                onClick={() => setSelectedDay(hasData ? c.day : null)}
                className={`aspect-square rounded-md text-[11px] flex flex-col items-center justify-center gap-0.5 border ${
                  isToday(c.day!)
                    ? "border-blue-400"
                    : isSel
                    ? "border-emerald-400"
                    : "border-gray-800"
                } ${hasData ? colorForCalories(cal) : "bg-gray-950"}`}
              >
                <span className={`font-bold ${hasData ? "text-white" : "text-gray-500"}`}>
                  {c.day}
                </span>
                {hasData && (
                  <span className="text-[11px] font-semibold leading-none text-white/90">
                    {cal}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-around text-[11px] text-gray-400">
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500/40 rounded" />少</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500/50 rounded" />適量</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500/50 rounded" />やや多</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500/50 rounded" />過剰</div>
        </div>
      </div>

      {/* 日付選択時の詳細 */}
      {selectedDayData && selectedDay !== null && (
        <div className="bg-gray-900 border border-emerald-500/40 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-base font-bold">
              {month}月{selectedDay}日の食事
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-gray-500 text-lg">
              ✕
            </button>
          </div>

          {/* PFC円グラフ付きサマリ */}
          <div className="bg-gray-800 rounded-xl p-3 grid grid-cols-[auto_1fr] gap-3 items-center">
            <PFCCircleChart
              protein={selectedDayData.totalProtein}
              carbs={selectedDayData.totalCarbs}
              fat={selectedDayData.totalFat}
              size={80}
            />
            <div className="grid grid-cols-4 gap-1">
              <DayStat
                label="kcal"
                value={`${selectedDayData.totalCalories}`}
                unit=""
                target={targetCal}
                current={selectedDayData.totalCalories}
              />
              <DayStat label="P" value={selectedDayData.totalProtein.toFixed(0)} unit="g" />
              <DayStat label="C" value={selectedDayData.totalCarbs.toFixed(0)} unit="g" />
              <DayStat label="F" value={selectedDayData.totalFat.toFixed(0)} unit="g" />
            </div>
          </div>

          {/* 食事区分別にグループ化 */}
          {(["朝食", "昼食", "夕食", "間食"] as const).map((mt) => {
            const typeMeals = selectedDayData.meals.filter((m) => (m.meal_type || "間食") === mt);
            if (typeMeals.length === 0) return null;
            const emoji = mt === "朝食" ? "🌅" : mt === "昼食" ? "☀️" : mt === "夕食" ? "🌙" : "🍩";
            const typeKcal = typeMeals.reduce((s, m) => s + (m.calories || 0), 0);
            return (
              <div key={mt} className="space-y-2">
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-lg">{emoji}</span>
                  <p className="text-sm font-bold text-emerald-300">{mt}</p>
                  <p className="text-xs text-gray-400 ml-auto">{typeKcal} kcal</p>
                </div>
                {typeMeals.map((m) => (
                  <div key={m.id} className="bg-gray-800 rounded-xl overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={m.image_url}
                      alt={m.menu_name || ""}
                      className="w-full aspect-video object-cover"
                    />
                    <div className="p-2.5 space-y-1">
                      <p className="text-sm font-bold">{m.menu_name || "判定不能"}</p>
                      <div className="flex flex-wrap gap-x-2 text-[11px] text-gray-400">
                        {m.calories !== null && <span>🔥{m.calories}kcal</span>}
                        {m.protein_g !== null && <span>P{m.protein_g}g</span>}
                        {m.carbs_g !== null && <span>C{m.carbs_g}g</span>}
                        {m.fat_g !== null && <span>F{m.fat_g}g</span>}
                        {m.score !== null && <span>⭐{m.score}</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {!loading && data?.stats && data.stats.recordedDays === 0 && (
        <div className="text-center text-gray-500 py-10">
          この月はまだ記録がありません
        </div>
      )}
    </div>
  );
}

function StatCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 rounded-lg px-2 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-emerald-300">{value}</p>
    </div>
  );
}

function DayStat({
  label,
  value,
  unit,
  target,
  current,
}: {
  label: string;
  value: string;
  unit: string;
  target?: number;
  current?: number;
}) {
  const achieved = target && current ? Math.min(100, (current / target) * 100) : 0;
  return (
    <div className="bg-gray-800 rounded-lg px-2 py-2 text-center">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm font-bold text-white">
        {value}
        <span className="text-[11px] font-normal text-gray-400 ml-0.5">{unit}</span>
      </p>
      {target && (
        <div className="h-1 bg-gray-700 rounded-full overflow-hidden mt-1">
          <div
            className={`h-full ${
              achieved >= 110 ? "bg-red-500" : achieved >= 90 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${achieved}%` }}
          />
        </div>
      )}
    </div>
  );
}

// ==================== プロフィール＆目標設定 ====================
type ProfileData = {
  profile: {
    name: string | null;
    age: number | null;
    height_cm: number | null;
    weight_kg: number | null;
    gender: "male" | "female" | "other" | null;
    activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active" | null;
  } | null;
  goal: {
    goal_type: "diet" | "maintain" | "muscle";
    target_calories: number;
    target_protein_g: number;
    target_weight_kg: number | null;
    target_period_weeks: number | null;
  } | null;
  weights: Array<{ weight_kg: number; recorded_at: string }>;
  recommendation: {
    bmi: number;
    bmiCategory: string;
    bmr: number;
    tdee: number;
    recommendedCalories: number;
    recommendedProteinG: number;
    recommendedCarbsG: number;
    recommendedFatG: number;
    weeklyWeightChange: number;
    estimatedWeeksToGoal: number | null;
  } | null;
};

const ACTIVITY_OPTIONS: Array<{
  value: "sedentary" | "light" | "moderate" | "active" | "very_active";
  label: string;
  desc: string;
}> = [
  { value: "sedentary", label: "💺 運動なし", desc: "1日中座り仕事" },
  { value: "light", label: "🚶 軽め", desc: "週1〜2回運動" },
  { value: "moderate", label: "🏃 普通", desc: "週3〜4回運動" },
  { value: "active", label: "💪 活発", desc: "週5回以上運動" },
  { value: "very_active", label: "🔥 アスリート", desc: "毎日激しい運動" },
];

function MealGoalView({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [data, setData] = useState<ProfileData | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 入力値
  const [age, setAge] = useState<number | "">("");
  const [heightCm, setHeightCm] = useState<number | "">("");
  const [weightKg, setWeightKg] = useState<number | "">("");
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [activityLevel, setActivityLevel] = useState<
    "sedentary" | "light" | "moderate" | "active" | "very_active"
  >("moderate");
  const [goalType, setGoalType] = useState<"diet" | "maintain" | "muscle">("maintain");
  const [targetWeight, setTargetWeight] = useState<number | "">("");
  const [targetPeriod, setTargetPeriod] = useState<number | "">(12); // 週

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/profile?deviceId=${encodeURIComponent(deviceId || "")}`);
      const d: ProfileData = await res.json();
      setData(d);
      if (d.profile) {
        if (d.profile.age) setAge(d.profile.age);
        if (d.profile.height_cm) setHeightCm(d.profile.height_cm);
        if (d.profile.weight_kg) setWeightKg(Number(d.profile.weight_kg));
        if (d.profile.gender) setGender(d.profile.gender);
        if (d.profile.activity_level) setActivityLevel(d.profile.activity_level);
      }
      if (d.goal) {
        setGoalType(d.goal.goal_type);
        if (d.goal.target_weight_kg) setTargetWeight(Number(d.goal.target_weight_kg));
        if (d.goal.target_period_weeks) setTargetPeriod(d.goal.target_period_weeks);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!age || !heightCm || !weightKg) {
      setMessage("⚠️ 年齢・身長・体重を入力してください");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          age: Number(age),
          heightCm: Number(heightCm),
          weightKg: Number(weightKg),
          gender,
          activityLevel,
          goalType,
          targetWeightKg: targetWeight ? Number(targetWeight) : undefined,
          targetPeriodWeeks: targetPeriod ? Number(targetPeriod) : undefined,
        }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = resData.error || "保存失敗";
        const detail = resData.detail ? `\n詳細: ${resData.detail}` : "";
        throw new Error(`${errMsg}${detail}`);
      }
      await load(); // 最新の推奨値を取得
      setShowSuccessModal(true); // 全画面モーダルで保存成功を表示
      // 画面上にスクロール（インラインメッセージも見えるように）
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (e) {
      setMessage(e instanceof Error ? `⚠️ ${e.message}` : "⚠️ 保存失敗");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="text-center text-gray-400 py-10 w-full max-w-md">
        読み込み中...
      </div>
    );

  const rec = data?.recommendation;
  const weights = data?.weights || [];

  return (
    <div className="w-full max-w-md space-y-4 relative">
      {/* 保存成功モーダル */}
      {showSuccessModal && (
        <SaveSuccessModal
          recommendation={rec}
          onClose={() => setShowSuccessModal(false)}
        />
      )}

      <button onClick={onBack} className="text-xs text-emerald-400">
        ← 食事メニューに戻る
      </button>

      <div className="card-accent-indigo p-4">
        <p className="text-sm font-bold text-indigo-300 mb-1">👤 プロフィール & 目標</p>
        <p className="text-xs text-gray-300 leading-relaxed">
          身長・体重・目標を入力するとガイコツ先生が科学的根拠に基づいてあなた専用のプランを自動計算します。
        </p>
      </div>

      {/* 基本情報 */}
      <div className="card-base p-4 space-y-3">
        <p className="text-sm font-bold text-white">👤 基本情報</p>

        {/* 性別 */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">性別</p>
          <div className="grid grid-cols-3 gap-2">
            {(["male", "female", "other"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGender(g)}
                className={`py-2 rounded-lg text-sm font-bold ${
                  gender === g
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                {g === "male" ? "男性" : g === "female" ? "女性" : "その他"}
              </button>
            ))}
          </div>
        </div>

        {/* 年齢 */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">年齢</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              min={15}
              max={99}
              placeholder="例: 45"
            />
            <span className="text-sm text-gray-400">歳</span>
          </div>
        </div>

        {/* 身長 */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">身長</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={heightCm}
              onChange={(e) => setHeightCm(e.target.value === "" ? "" : parseInt(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              min={100}
              max={220}
              placeholder="例: 170"
            />
            <span className="text-sm text-gray-400">cm</span>
          </div>
        </div>

        {/* 体重 */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">体重（現在）</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
              min={30}
              max={200}
              step={0.1}
              placeholder="例: 68.5"
            />
            <span className="text-sm text-gray-400">kg</span>
          </div>
        </div>

        {/* 活動レベル */}
        <div>
          <p className="text-xs text-gray-400 mb-1.5">活動レベル</p>
          <div className="space-y-1.5">
            {ACTIVITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setActivityLevel(opt.value)}
                className={`w-full px-3 py-2 rounded-lg text-left flex items-center justify-between text-xs ${
                  activityLevel === opt.value
                    ? "bg-indigo-600/30 border border-indigo-500"
                    : "bg-gray-800 border border-gray-700 text-gray-300"
                }`}
              >
                <span className="font-bold">{opt.label}</span>
                <span className="text-[11px] text-gray-400">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 目標 */}
      <div className="card-base p-4 space-y-3">
        <p className="text-sm font-bold text-white">🎯 目標</p>

        <div className="grid grid-cols-3 gap-2">
          {(["diet", "maintain", "muscle"] as const).map((g) => {
            const labels: Record<string, { emoji: string; label: string }> = {
              diet: { emoji: "🥗", label: "減量" },
              maintain: { emoji: "⚖️", label: "維持" },
              muscle: { emoji: "💪", label: "増量" },
            };
            return (
              <button
                key={g}
                onClick={() => setGoalType(g)}
                className={`py-3 rounded-lg text-sm font-bold ${
                  goalType === g
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
                }`}
              >
                <div className="text-2xl">{labels[g].emoji}</div>
                <div className="text-xs mt-1">{labels[g].label}</div>
              </button>
            );
          })}
        </div>

        {/* 目標体重（維持以外） */}
        {goalType !== "maintain" && (
          <>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">
                目標体重（{goalType === "diet" ? "減らしたい体重" : "増やしたい体重"}）
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={targetWeight}
                  onChange={(e) =>
                    setTargetWeight(e.target.value === "" ? "" : parseFloat(e.target.value))
                  }
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  min={30}
                  max={200}
                  step={0.1}
                  placeholder="例: 65"
                />
                <span className="text-sm text-gray-400">kg</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1.5">達成目標期間</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={targetPeriod}
                  onChange={(e) =>
                    setTargetPeriod(e.target.value === "" ? "" : parseInt(e.target.value))
                  }
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  min={4}
                  max={104}
                  placeholder="例: 12"
                />
                <span className="text-sm text-gray-400">週</span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ガイコツ先生の計算結果 */}
      {rec && (
        <div className="card-accent-emerald p-4 space-y-3">
          <p className="text-sm font-bold text-emerald-300 flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-skeleton-sensei-face.png"
              alt="ガイコツ先生"
              className="w-8 h-8 object-contain"
            />
            ガイコツ先生があなた専用に計算した推奨値
          </p>
          <div className="grid grid-cols-2 gap-2">
            <InfoCell label="BMI" value={`${rec.bmi}`} sub={rec.bmiCategory} />
            <InfoCell label="基礎代謝" value={`${rec.bmr}`} sub="kcal/日" />
            <InfoCell label="1日総消費" value={`${rec.tdee}`} sub="kcal/日" />
            <InfoCell
              label="推奨摂取"
              value={`${rec.recommendedCalories}`}
              sub="kcal/日"
              highlight
            />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <InfoCell label="タンパク質" value={`${rec.recommendedProteinG}`} sub="g" />
            <InfoCell label="炭水化物" value={`${rec.recommendedCarbsG}`} sub="g" />
            <InfoCell label="脂質" value={`${rec.recommendedFatG}`} sub="g" />
          </div>
          {rec.weeklyWeightChange !== 0 && (
            <div className="text-xs text-gray-300 bg-gray-800/50 rounded-lg px-3 py-2 mt-2">
              📈 予想ペース: 週{" "}
              <span
                className={
                  rec.weeklyWeightChange < 0 ? "text-emerald-400 font-bold" : "text-blue-400 font-bold"
                }
              >
                {rec.weeklyWeightChange > 0 ? "+" : ""}
                {rec.weeklyWeightChange}kg
              </span>
              {rec.estimatedWeeksToGoal !== null && (
                <span> / 目標達成まで 約{rec.estimatedWeeksToGoal}週</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* 体重履歴（グラフ） */}
      {weights.length >= 2 && (
        <WeightChart weights={weights} goalWeight={targetWeight ? Number(targetWeight) : null} />
      )}

      {message && (
        <div
          className={`rounded-xl px-4 py-2.5 text-sm ${
            message.startsWith("✅")
              ? "card-accent-emerald text-emerald-200"
              : "bg-red-500/10 border border-red-500/30 text-red-300"
          }`}
        >
          {message}
        </div>
      )}

      <button
        onClick={save}
        disabled={saving}
        className="btn-secondary w-full px-4 py-4 text-base disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存する"}
      </button>
    </div>
  );
}

// ==================== 保存成功モーダル ====================
function SaveSuccessModal({
  recommendation,
  onClose,
}: {
  recommendation: ProfileData["recommendation"] | null | undefined;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-gradient-to-br from-emerald-500 via-emerald-600 to-green-700 rounded-3xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ガイコツ先生の顔 + チェックマーク */}
        <div className="flex justify-center mb-4 relative">
          <div className="w-36 h-36 rounded-full bg-white border-4 border-white flex items-center justify-center shadow-lg overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-skeleton-sensei-face.png"
              alt="ガイコツ先生"
              className="w-32 h-32 object-contain"
            />
          </div>
          {/* 右下に小さなチェックマークバッジ */}
          <div className="absolute bottom-0 right-[calc(50%-4.5rem)] w-12 h-12 rounded-full bg-emerald-500 border-4 border-white flex items-center justify-center shadow-md">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-6 h-6"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        <h2 className="text-2xl font-extrabold text-white text-center mb-2 drop-shadow">
          保存しました！
        </h2>
        <p className="text-sm text-emerald-50 text-center mb-4 leading-relaxed">
          ガイコツ先生があなた専用のプランを
          <br />
          計算しました 💪
        </p>

        {/* ガイコツ先生の計算結果サマリ */}
        {recommendation && (
          <div className="bg-white/15 backdrop-blur-sm rounded-2xl p-4 space-y-2.5 mb-5">
            <p className="text-xs text-emerald-100 font-semibold text-center flex items-center justify-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                className="w-7 h-7 object-contain"
              />
              ガイコツ先生があなた専用に算出
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
                <p className="text-[11px] text-emerald-50">1日の摂取カロリー</p>
                <p className="text-xl font-extrabold text-white">
                  {recommendation.recommendedCalories}
                  <span className="text-xs font-normal ml-0.5">kcal</span>
                </p>
              </div>
              <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
                <p className="text-[11px] text-emerald-50">タンパク質</p>
                <p className="text-xl font-extrabold text-white">
                  {recommendation.recommendedProteinG}
                  <span className="text-xs font-normal ml-0.5">g</span>
                </p>
              </div>
              <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
                <p className="text-[11px] text-emerald-50">BMI</p>
                <p className="text-base font-extrabold text-white">
                  {recommendation.bmi}
                  <span className="text-[11px] font-normal ml-1">{recommendation.bmiCategory}</span>
                </p>
              </div>
              <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
                <p className="text-[11px] text-emerald-50">基礎代謝</p>
                <p className="text-base font-extrabold text-white">
                  {recommendation.bmr}
                  <span className="text-[11px] font-normal ml-0.5">kcal</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-3.5 bg-white rounded-2xl font-extrabold text-emerald-700 text-base shadow-md active:scale-95 transition"
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ==================== MYセット保存モーダル ====================
function SaveMySetModal({
  analysis,
  saving,
  onSave,
  onClose,
}: {
  analysis: MealAnalysis;
  saving: boolean;
  onSave: (name: string, icon: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(analysis.menu_name || "");
  const [icon, setIcon] = useState("🍽️");

  const icons = ["🍽️", "🍚", "🥗", "🍜", "🍛", "🍝", "🥪", "🍱", "🍰", "☕", "🍎", "🥞"];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl p-5 shadow-2xl space-y-3"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-extrabold text-emerald-300">⭐ MYセットに保存</h3>
        <p className="text-xs text-gray-400">
          次回から1タップで同じ食事を記録できます
        </p>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">セット名</p>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例: いつもの朝食"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            maxLength={30}
          />
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-1.5">アイコン</p>
          <div className="grid grid-cols-6 gap-1.5">
            {icons.map((i) => (
              <button
                key={i}
                onClick={() => setIcon(i)}
                className={`py-2 text-xl rounded-lg ${
                  icon === i ? "bg-emerald-600" : "bg-gray-800 border border-gray-700"
                }`}
              >
                {i}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg px-3 py-2 text-[11px] text-gray-400">
          {analysis.menu_name} / 🔥{analysis.calories || 0}kcal / P{analysis.protein_g || 0}g
        </div>

        <div className="flex gap-2 pt-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-gray-800 rounded-xl text-sm font-bold"
          >
            キャンセル
          </button>
          <button
            onClick={() => onSave(name, icon)}
            disabled={saving || !name.trim()}
            className="flex-1 py-2.5 bg-gradient-to-r from-amber-500 to-yellow-600 disabled:opacity-50 rounded-xl text-sm font-bold"
          >
            {saving ? "保存中..." : "保存する"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCell({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        highlight ? "bg-emerald-600/20 border border-emerald-500" : "bg-gray-900/50"
      }`}
    >
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className={`text-base font-extrabold ${highlight ? "text-emerald-300" : "text-white"}`}>
        {value}
        {sub && <span className="text-[11px] font-normal text-gray-400 ml-0.5">{sub}</span>}
      </p>
    </div>
  );
}

// ==================== 体重グラフ ====================
function WeightChart({
  weights,
  goalWeight,
}: {
  weights: Array<{ weight_kg: number; recorded_at: string }>;
  goalWeight: number | null;
}) {
  if (weights.length < 2) return null;
  const values = weights.map((w) => Number(w.weight_kg));
  const min = Math.min(...values, goalWeight || Infinity) - 1;
  const max = Math.max(...values, goalWeight || -Infinity) + 1;
  const range = max - min || 1;

  const width = 300;
  const height = 120;
  const paddingLeft = 35;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 20;
  const chartW = width - paddingLeft - paddingRight;
  const chartH = height - paddingTop - paddingBottom;

  const points = values.map((v, i) => {
    const x = paddingLeft + (i / (values.length - 1)) * chartW;
    const y = paddingTop + ((max - v) / range) * chartH;
    return { x, y, v };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");

  const firstWeight = values[0];
  const lastWeight = values[values.length - 1];
  const diff = Number((lastWeight - firstWeight).toFixed(1));

  return (
    <div className="card-base p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-bold text-white">📉 体重の推移</p>
        <p className={`text-xs font-bold ${diff < 0 ? "text-emerald-400" : diff > 0 ? "text-amber-400" : "text-gray-400"}`}>
          {diff > 0 ? "+" : ""}
          {diff} kg
        </p>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full">
        {/* Y軸ラベル */}
        <text x={2} y={paddingTop + 10} fontSize="9" fill="#666">
          {max.toFixed(1)}
        </text>
        <text x={2} y={height - paddingBottom + 3} fontSize="9" fill="#666">
          {min.toFixed(1)}
        </text>
        {/* 目標ライン */}
        {goalWeight && (
          <line
            x1={paddingLeft}
            y1={paddingTop + ((max - goalWeight) / range) * chartH}
            x2={paddingLeft + chartW}
            y2={paddingTop + ((max - goalWeight) / range) * chartH}
            stroke="#f59e0b"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        )}
        {/* 折れ線 */}
        <path d={pathD} stroke="#10b981" strokeWidth="2" fill="none" />
        {/* 点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#10b981" />
        ))}
      </svg>
      <p className="text-[11px] text-gray-500 text-center mt-1">
        {new Date(weights[0].recorded_at).toLocaleDateString("ja-JP")} 〜{" "}
        {new Date(weights[weights.length - 1].recorded_at).toLocaleDateString("ja-JP")}
      </p>
    </div>
  );
}

// ==================== サブスク管理画面 ====================
type SubscriptionState = {
  status: "free" | "trial" | "active_monthly" | "active_yearly" | "cancelled" | "expired";
  isPaid: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  usage: { posture: number; chat: number; meal: number };
  limits: {
    posture: number | "unlimited";
    chat: number | "unlimited";
    meal: number | "unlimited";
  };
};

function SubscriptionScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadState = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(`/api/subscription?deviceId=${encodeURIComponent(deviceId || "")}`);
      const data = await res.json();
      if (res.ok) setState(data);
    } catch {
      setError("プラン情報の取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadState();
  }, [loadState]);

  const callAction = async (
    action: "start_trial" | "subscribe" | "cancel",
    plan?: "monthly" | "yearly"
  ) => {
    setActing(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, plan, deviceId: getDeviceId() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "操作に失敗しました");
      if (action === "start_trial") setMessage("✅ 7日間の無料トライアルを開始しました！");
      else if (action === "subscribe") setMessage(`✅ ${plan === "monthly" ? "月額" : "年額"}プランを開始しました！`);
      else if (action === "cancel") setMessage("次回更新時に解約されます（期限までは引き続き利用可能です）");
      await loadState();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setActing(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("ja-JP");
  };

  const statusLabel: Record<SubscriptionState["status"], string> = {
    free: "無料プラン",
    trial: "🎁 無料トライアル中",
    active_monthly: "👑 月額プラン",
    active_yearly: "👑 年額プラン",
    cancelled: "解約予約済み（期限まで利用可）",
    expired: "期限切れ・無料プラン",
  };

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">👑 プラン管理</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {loading && <div className="text-center text-gray-400 py-10">読み込み中...</div>}

        {message && (
          <div className="bg-emerald-500/20 border border-emerald-500/40 rounded-xl px-4 py-3 text-sm text-emerald-300">
            {message}
          </div>
        )}

        {error && (
          <div className="bg-red-500/20 border border-red-500/40 rounded-xl px-4 py-3 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {state && (
          <>
            {/* 現在のステータス */}
            <div className={state.isPaid ? "card-accent-amber p-5" : "card-base p-5"}>
              <p className="text-xs text-gray-400 mb-1 tracking-wide">現在のプラン</p>
              <p className="text-lg font-bold text-white">{statusLabel[state.status]}</p>
              {state.trialEndsAt && state.status === "trial" && (
                <p className="text-xs text-amber-300 mt-2">
                  トライアル終了: {formatDate(state.trialEndsAt)}
                </p>
              )}
              {state.currentPeriodEnd && (state.status === "active_monthly" || state.status === "active_yearly" || state.status === "cancelled") && (
                <p className="text-xs text-gray-300 mt-2">
                  {state.status === "cancelled" ? "期限" : "次回更新"}: {formatDate(state.currentPeriodEnd)}
                </p>
              )}
            </div>

            {/* 今月の利用状況 */}
            {!state.isPaid && (
              <div className="card-base p-4">
                <p className="text-xs text-gray-400 mb-3 font-bold tracking-wide">今月の利用状況</p>
                <UsageRow
                  label="姿勢チェック"
                  usage={state.usage.posture}
                  limit={state.limits.posture}
                />
                <UsageRow
                  label="AIチャット"
                  usage={state.usage.chat}
                  limit={state.limits.chat}
                />
                <UsageRow
                  label="食事分析"
                  usage={state.usage.meal}
                  limit={state.limits.meal}
                />
              </div>
            )}

            {/* プラン案内（無料プラン時のみ） */}
            {!state.isPaid && (
              <>
                <div className="card-accent-amber p-5 space-y-3">
                  <p className="text-base font-bold text-amber-300">
                    👑 プレミアムプランで全機能開放
                  </p>
                  <ul className="text-sm text-gray-200 space-y-1.5">
                    <li>✅ 姿勢チェック・AIチャット・食事分析 無制限</li>
                    <li>✅ 30種類のストレッチ全開放</li>
                    <li>✅ 音声ガイド機能</li>
                    <li>✅ 過去データを無期限保存</li>
                    <li>✅ AI姿勢写真分析</li>
                  </ul>
                </div>

                {/* 無料トライアルボタン */}
                {state.status !== "expired" && (
                  <button
                    onClick={() => callAction("start_trial")}
                    disabled={acting}
                    className="btn-primary w-full px-5 py-4 disabled:opacity-50"
                  >
                    🎁 7日間無料で試す
                  </button>
                )}

                {/* 月額プラン */}
                <button
                  onClick={() => callAction("subscribe", "monthly")}
                  disabled={acting}
                  className="card-base w-full px-5 py-4 text-left flex items-center justify-between disabled:opacity-50 active:scale-[0.99] transition"
                >
                  <div>
                    <p className="text-sm font-bold text-white">月額プラン</p>
                    <p className="text-xs text-gray-400 mt-0.5">いつでも解約可能</p>
                  </div>
                  <p className="text-lg font-extrabold text-white">
                    ¥1,280<span className="text-xs font-normal text-gray-400">/月</span>
                  </p>
                </button>

                {/* 年額プラン（おすすめ） */}
                <button
                  onClick={() => callAction("subscribe", "yearly")}
                  disabled={acting}
                  className="card-accent-indigo w-full px-5 py-4 text-left flex items-center justify-between disabled:opacity-50 active:scale-[0.99] transition relative overflow-hidden"
                >
                  <span className="absolute top-0 right-0 bg-red-500 text-white text-[11px] font-extrabold px-2 py-0.5 rounded-bl-xl">
                    2ヶ月分お得
                  </span>
                  <div>
                    <p className="text-sm font-bold text-white">年額プラン ⭐ おすすめ</p>
                    <p className="text-xs text-indigo-300 mt-0.5">月額換算 ¥1,067（17%オフ）</p>
                  </div>
                  <p className="text-lg font-extrabold text-white">
                    ¥12,800<span className="text-xs font-normal text-gray-400">/年</span>
                  </p>
                </button>
              </>
            )}

            {/* 有料プラン時の解約ボタン */}
            {state.isPaid && state.status !== "cancelled" && state.status !== "trial" && (
              <button
                onClick={() => {
                  if (confirm("本当に解約しますか？期限までは引き続き利用できます。")) {
                    callAction("cancel");
                  }
                }}
                disabled={acting}
                className="btn-neutral w-full px-4 py-3 text-sm text-gray-400"
              >
                解約する
              </button>
            )}

            {/* 注意書き */}
            <div className="card-base px-4 py-3 text-[11px] text-gray-500 leading-relaxed">
              ℹ️ 現在は開発中のため、実際の決済は発生しません。App Storeリリース時にApple App Store経由の課金に切り替わります。解約・返金はApp Storeの規約に従います。
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function UsageRow({
  label,
  usage,
  limit,
}: {
  label: string;
  usage: number;
  limit: number | "unlimited";
}) {
  const max = limit === "unlimited" ? 999 : limit;
  const pct = limit === "unlimited" ? 0 : Math.min(100, (usage / max) * 100);
  const isFull = limit !== "unlimited" && usage >= limit;
  return (
    <div className="mb-2.5 last:mb-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-300">{label}</span>
        <span className={`text-xs font-bold ${isFull ? "text-red-400" : "text-gray-400"}`}>
          {usage} / {limit === "unlimited" ? "無制限" : limit}
        </span>
      </div>
      {limit !== "unlimited" && (
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${isFull ? "bg-red-500" : "bg-emerald-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}
