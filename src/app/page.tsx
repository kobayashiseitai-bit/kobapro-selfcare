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

type Screen = "loading" | "register" | "onboarding" | "home" | "ai-counsel" | "selfcare" | "check" | "history" | "meal" | "subscription" | "report" | "invite" | "before-after" | "sensei-profile" | "family" | "coaching";

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
    colorTheme: "emerald" as const,
    gradientFrom: "from-emerald-400/30",
    gradientTo: "to-teal-500/20",
    borderColor: "border-emerald-500/40",
    iconBg: "from-emerald-400 to-teal-500",
    accentText: "text-emerald-600",
    subtitle: "デスクワークの疲れをリセット",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "首こり解消セルフケア",
    description: "首周りの筋肉をほぐし、痛みを和らげるストレッチです。",
  },
  {
    id: "shoulder_stiff",
    label: "肩こり",
    emoji: "💪",
    icon: "/menyu6.jpg",
    colorTheme: "teal" as const,
    gradientFrom: "from-teal-400/30",
    gradientTo: "to-cyan-500/20",
    borderColor: "border-teal-500/40",
    iconBg: "from-teal-400 to-cyan-500",
    accentText: "text-teal-600",
    subtitle: "肩甲骨まわりをじんわり緩める",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "肩こり解消セルフケア",
    description: "固まった肩周りをほぐすストレッチです。",
  },
  {
    id: "back",
    label: "腰痛",
    emoji: "🔥",
    icon: "/menyu5.jpg",
    colorTheme: "sky" as const,
    gradientFrom: "from-sky-400/30",
    gradientTo: "to-blue-500/20",
    borderColor: "border-sky-500/40",
    iconBg: "from-sky-400 to-blue-500",
    accentText: "text-sky-600",
    subtitle: "重だるい腰をふわっと軽く",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "腰痛改善セルフケア",
    description: "腰回りの筋肉を緩め、腰痛を予防・改善するストレッチです。",
  },
  {
    id: "headache",
    label: "頭痛",
    emoji: "🧠",
    icon: "/menyu3.jpg",
    colorTheme: "indigo" as const,
    gradientFrom: "from-indigo-400/30",
    gradientTo: "to-purple-500/20",
    borderColor: "border-indigo-500/40",
    iconBg: "from-indigo-400 to-purple-500",
    accentText: "text-indigo-600",
    subtitle: "ズキズキを和らげるツボ押し",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "頭痛緩和セルフケア",
    description: "頭痛を和らげるツボ押しと首肩のストレッチです。",
  },
  {
    id: "eye_fatigue",
    label: "眼精疲労",
    emoji: "👁️",
    icon: "/menyu4.jpg",
    colorTheme: "rose" as const,
    gradientFrom: "from-rose-400/30",
    gradientTo: "to-pink-500/20",
    borderColor: "border-rose-500/40",
    iconBg: "from-rose-400 to-pink-500",
    accentText: "text-rose-600",
    subtitle: "目の疲れをリフレッシュ",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "眼精疲労解消セルフケア",
    description: "目の疲れを取り、スッキリさせるツボ押し＆エクササイズです。",
  },
  {
    id: "kyphosis",
    label: "猫背改善",
    emoji: "🧍",
    icon: "/menyu1.jpg",
    colorTheme: "amber" as const,
    gradientFrom: "from-amber-400/30",
    gradientTo: "to-orange-500/20",
    borderColor: "border-amber-500/40",
    iconBg: "from-amber-400 to-orange-500",
    accentText: "text-amber-600",
    subtitle: "美しい姿勢をインストール",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "猫背改善エクササイズ",
    description: "猫背を矯正し、正しい姿勢を身につけるエクササイズです。",
  },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);
  const [mealInitialMode, setMealInitialMode] = useState<"home" | "goal" | "calendar" | null>(null);
  const [chatConsultMeal, setChatConsultMeal] = useState(false);

  const goToMealWithMode = (mode: "home" | "goal" | "calendar") => {
    setMealInitialMode(mode);
    setScreen("meal");
  };

  const goToChatWithMeal = () => {
    setChatConsultMeal(true);
    setScreen("ai-counsel");
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
      {screen === "register" && (
        <RegisterScreen
          onComplete={() => {
            const onboarded = localStorage.getItem("zero_pain_onboarded") === "1";
            setScreen(onboarded ? "home" : "onboarding");
          }}
        />
      )}
      {screen === "onboarding" && <OnboardingScreen onNavigate={setScreen} />}
      {screen === "home" && <HomeScreen onNavigate={setScreen} onSelectSymptom={goToSelfcare} onGoToMealMode={goToMealWithMode} />}
      {screen === "ai-counsel" && (
        <AiCounselScreen
          onNavigate={setScreen}
          onSelectSymptom={goToSelfcare}
          consultMeal={chatConsultMeal}
          onMealConsumed={() => setChatConsultMeal(false)}
        />
      )}
      {screen === "selfcare" && <SelfcareScreen onNavigate={setScreen} initialSymptomId={selectedSymptomId} />}
      {screen === "check" && <CheckScreen onNavigate={setScreen} />}
      {screen === "history" && <HistoryScreen onNavigate={setScreen} />}
      {screen === "meal" && (
        <MealScreen
          onNavigate={setScreen}
          initialMode={mealInitialMode}
          onModeConsumed={() => setMealInitialMode(null)}
          onConsultMeal={goToChatWithMeal}
        />
      )}
      {screen === "subscription" && <SubscriptionScreen onNavigate={setScreen} />}
      {screen === "report" && <ReportScreen onNavigate={setScreen} />}
      {screen === "invite" && <InviteScreen onNavigate={setScreen} />}
      {screen === "before-after" && <BeforeAfterScreen onNavigate={setScreen} />}
      {screen === "sensei-profile" && <SenseiProfileScreen onNavigate={setScreen} />}
      {screen === "family" && <FamilyScreen onNavigate={setScreen} />}
      {screen === "coaching" && <CoachingScreen onNavigate={setScreen} onSelectSymptom={goToSelfcare} />}
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

// ==================== 🌟 オンボーディング（初回体験） ====================
function OnboardingScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [slide, setSlide] = useState(0);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    // ユーザー名を取得（登録直後）
    const fetchUserName = async () => {
      try {
        const deviceId = getDeviceId();
        if (!deviceId) return;
        const res = await fetch(
          `/api/checkin?deviceId=${encodeURIComponent(deviceId)}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (data.userName) setUserName(data.userName);
      } catch {
        /* ignore */
      }
    };
    fetchUserName();
  }, []);

  const slides = useMemo(
    () => [
      {
        emoji: "🦴",
        title: userName ? `${userName}さん、はじめまして！` : "はじめまして！",
        subtitle: "ガイコツ先生です",
        description:
          "生前は30年間、1万人の体を整えてきた名カイロプラクター。骨だけになっても、あなたの体と人生を支えます。",
        image: "/icon-skeleton-sensei.png",
      },
      {
        emoji: "🧍",
        title: "AIが姿勢を瞬時に分析",
        subtitle: "スマホ1台で本格チェック",
        description:
          "全身撮影するだけで、肩のズレ・骨盤の傾き・重心バランスなど、カイロプラクティックの視点で姿勢を分析します。",
        image: "/icon-skeleton-sensei-face.png",
      },
      {
        emoji: "💫",
        title: "毎朝30秒で体が変わる",
        subtitle: "コンディションチェック習慣",
        description:
          "朝の体調タップ → AIがその日のケアを提案。続けるほど、ガイコツ先生との関係も深まります（31日目にはタメ口も）。",
        image: "/icon-skeleton-sensei-face.png",
      },
    ],
    [userName]
  );

  const completeOnboarding = () => {
    localStorage.setItem("zero_pain_onboarded", "1");
  };

  const handleNext = () => {
    if (slide < slides.length - 1) {
      setSlide(slide + 1);
    } else {
      // 完了 → 最初の姿勢チェックへ
      completeOnboarding();
      // 初回姿勢チェックのフラグを立てる（CheckScreen で祝福演出のため）
      localStorage.setItem("zero_pain_first_check_pending", "1");
      onNavigate("check");
    }
  };

  const handleSkip = () => {
    completeOnboarding();
    onNavigate("home");
  };

  const current = slides[slide];

  return (
    <main className="fixed inset-0 bg-gradient-to-b from-gray-950 via-indigo-950/30 to-gray-950 text-white flex flex-col">
      {/* スキップボタン */}
      <div className="flex justify-end px-4 pt-4">
        <button
          onClick={handleSkip}
          className="text-xs text-gray-500 hover:text-gray-300 px-3 py-1.5"
        >
          スキップ →
        </button>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* キャラクターイラスト */}
        <div className="relative mb-6">
          {/* グロー効果 */}
          <div className="absolute inset-0 blur-3xl bg-indigo-500/30 rounded-full scale-125" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.image}
            alt="ガイコツ先生"
            className="relative w-40 h-40 object-contain drop-shadow-[0_0_40px_rgba(99,102,241,0.6)]"
          />
        </div>

        {/* タイトル */}
        <p className="text-4xl mb-2">{current.emoji}</p>
        <h1 className="text-2xl font-extrabold text-white text-center leading-tight mb-1">
          {current.title}
        </h1>
        <p className="text-sm text-indigo-300 font-bold mb-5">{current.subtitle}</p>

        {/* 説明 */}
        <p className="text-sm text-gray-300 text-center leading-relaxed max-w-sm mb-8">
          {current.description}
        </p>

        {/* 進捗ドット */}
        <div className="flex gap-2 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === slide
                  ? "w-8 bg-indigo-400"
                  : i < slide
                  ? "w-2 bg-indigo-600"
                  : "w-2 bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* ボタン */}
        <button
          onClick={handleNext}
          className="w-full max-w-sm py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:brightness-110 rounded-2xl font-extrabold text-white shadow-[0_8px_24px_rgba(99,102,241,0.5)] active:scale-[0.98] transition"
        >
          {slide < slides.length - 1 ? "次へ →" : "📷 さっそく始める"}
        </button>

        {/* 最終ページでの追加テキスト */}
        {slide === slides.length - 1 && (
          <p className="text-[11px] text-gray-500 mt-4 text-center">
            最初の姿勢チェックで「Before写真」が保存されます
          </p>
        )}
      </div>
    </main>
  );
}

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
  const [showInviteInput, setShowInviteInput] = useState(false);
  const [inviteCode, setInviteCode] = useState("");

  // URLパラメータから招待コードを自動取得（共有URL経由の登録）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("invite");
    if (code) {
      setInviteCode(code.toUpperCase());
      setShowInviteInput(true);
    }
  }, []);

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
        // 招待コードがあれば適用
        if (inviteCode.trim()) {
          try {
            const inviteRes = await fetch("/api/invite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                deviceId: getDeviceId(),
                code: inviteCode.trim(),
              }),
            });
            const inviteData = await inviteRes.json();
            if (!inviteRes.ok) {
              // 招待失敗は警告だけで登録は成功扱い
              alert(`招待コードは適用されませんでした: ${inviteData.error || ""}`);
            } else {
              alert(inviteData.message || "🎁 招待コードを適用しました！");
            }
          } catch {
            // エラー時も登録自体は成功
          }
        }
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

            {/* 招待コード入力欄（折りたたみ式） */}
            {!showInviteInput ? (
              <button
                type="button"
                onClick={() => setShowInviteInput(true)}
                className="w-full py-2.5 text-xs text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1"
              >
                🎁 招待コードをお持ちですか？
              </button>
            ) : (
              <div className="card-accent-amber p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-amber-300">
                    🎁 招待コード（お持ちの方）
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteInput(false);
                      setInviteCode("");
                    }}
                    className="text-[10px] text-gray-400"
                  >
                    閉じる
                  </button>
                </div>
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                  placeholder="例: KOBA2026"
                  maxLength={12}
                  className="w-full px-4 py-2.5 bg-gray-800 border border-amber-500/30 rounded-lg text-white focus:outline-none focus:border-amber-500 text-sm font-mono tracking-wider text-center"
                />
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  招待コードを入力すると、無料トライアルが<strong className="text-amber-300">7日→14日に延長</strong>されます ✨
                </p>
              </div>
            )}
          </div>

          {/* ヘルスケア免責 */}
          <div className="card-accent-amber p-4">
            <p className="text-sm font-bold text-amber-300 mb-1.5">
              ⚠️ ご利用前に必ずお読みください
            </p>
            <p className="text-xs text-gray-200 leading-relaxed">
              本アプリは、カイロプラクターの一般的な知見に基づくセルフケア情報を提供するものであり、
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
  // 朝のチェックイン通知設定
  const [morningNotifEnabled, setMorningNotifEnabled] = useState(false);
  const [morningNotifHour, setMorningNotifHour] = useState(8); // 0-23
  const [morningNotifMinute, setMorningNotifMinute] = useState(0); // 0-59

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

  // ☀️ 朝のコンディションチェック通知をスケジュール（ID=3、毎日指定時刻）
  const scheduleMorningCheckinNotification = async (hour: number, minute: number = 0) => {
    if (!isNativePlatform()) {
      // Web環境: ブラウザ通知許可だけ求める
      if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      return;
    }
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      // 既存の朝通知をキャンセル
      await LocalNotifications.cancel({ notifications: [{ id: 3 }] });
      // 権限取得
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return;

      // 次回の発火時刻（今日 or 明日の指定時刻）
      const now = new Date();
      const target = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        hour,
        minute,
        0
      );
      // すでに過ぎていたら翌日に
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      // メッセージはランダムに選ぶ（マンネリ防止）
      const titles = [
        "☀️ おはようございます！",
        "🦴 ガイコツ先生がお待ちです",
        "☕ 今日のコンディションは？",
        "🌅 今日も一緒にコツコツ",
      ];
      const bodies = [
        "30秒で完了！今日の体調をチェックしましょう",
        "今日のコンディションを教えてくださいね",
        "朝のチェックインで今日のケアが決まります",
        "ガイコツ先生から今日のアドバイスが届きます",
      ];
      const title = titles[Math.floor(Math.random() * titles.length)];
      const body = bodies[Math.floor(Math.random() * bodies.length)];

      await LocalNotifications.schedule({
        notifications: [
          {
            id: 3,
            title,
            body,
            schedule: {
              at: target,
              repeats: true,
              every: "day",
            },
            sound: "default",
          },
        ],
      });
    } catch (e) {
      console.error("Morning checkin notification error:", e);
    }
  };

  // 朝通知キャンセル
  const cancelMorningCheckinNotification = async () => {
    if (!isNativePlatform()) return;
    try {
      const { LocalNotifications } = await import("@capacitor/local-notifications");
      await LocalNotifications.cancel({ notifications: [{ id: 3 }] });
    } catch (e) {
      console.error("Morning notification cancel error:", e);
    }
  };

  // 朝のチェックイン通知設定の読み込み
  useEffect(() => {
    const enabled = localStorage.getItem("zero_pain_morning_notif") === "1";
    const hour = parseInt(localStorage.getItem("zero_pain_morning_hour") || "8");
    const minute = parseInt(localStorage.getItem("zero_pain_morning_minute") || "0");
    setMorningNotifEnabled(enabled);
    setMorningNotifHour(hour);
    setMorningNotifMinute(minute);
    // 有効なら再スケジュール（起動のたびに最新状態に）
    if (enabled) {
      scheduleMorningCheckinNotification(hour, minute);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 朝通知の設定を保存＆適用
  const saveMorningNotifSettings = async (
    enabled: boolean,
    hour: number,
    minute: number
  ) => {
    setMorningNotifEnabled(enabled);
    setMorningNotifHour(hour);
    setMorningNotifMinute(minute);
    localStorage.setItem("zero_pain_morning_notif", enabled ? "1" : "0");
    localStorage.setItem("zero_pain_morning_hour", String(hour));
    localStorage.setItem("zero_pain_morning_minute", String(minute));
    if (enabled) {
      await scheduleMorningCheckinNotification(hour, minute);
    } else {
      await cancelMorningCheckinNotification();
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
        <h1 className="text-lg font-extrabold brand-logo tracking-[0.2em]">ZERO-PAIN</h1>
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
              onClick={() => { setShowMenu(false); onNavigate("coaching"); }}
              className="card-accent-emerald w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">🎯</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">30日コーチング</p>
                <p className="text-[11px] text-emerald-200">AIがあなた専用プランを生成</p>
              </div>
              <span className="text-emerald-300">›</span>
            </button>

            <button
              onClick={() => { setShowMenu(false); onNavigate("family"); }}
              className="card-accent-emerald w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">👨‍👩‍👧</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">家族プラン</p>
                <p className="text-[11px] text-emerald-200">1契約で家族4人まで使える</p>
              </div>
              <span className="text-emerald-300">›</span>
            </button>

            <button
              onClick={() => { setShowMenu(false); onNavigate("invite"); }}
              className="card-accent-amber w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">🎁</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">友達を招待</p>
                <p className="text-[11px] text-amber-200">招待成立で1ヶ月無料！</p>
              </div>
              <span className="text-amber-300">›</span>
            </button>

            <button
              onClick={() => { setShowMenu(false); onNavigate("report"); }}
              className="card-accent-indigo w-full text-left p-3 flex items-center gap-3 active:scale-[0.98] transition"
            >
              <span className="text-2xl">📊</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">ガイコツ先生のレポート</p>
                <p className="text-[11px] text-indigo-200">週次・月次の振り返り</p>
              </div>
              <span className="text-indigo-300">›</span>
            </button>

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

        {/* ☀️ 朝のコンディションチェック（毎日1回・AIパーソナライズ） */}
        <MorningCheckinCard
          onNavigate={onNavigate}
          onSelectSymptom={onSelectSymptom}
          morningNotifEnabled={morningNotifEnabled}
          onEnableMorningNotif={async () => {
            await saveMorningNotifSettings(true, 8, 0);
            setShowReminderSetting(true);
          }}
        />

        {/* 🎯 進行中の30日コーチング（あれば今日の課題を表示） */}
        <CoachingTodayCard onNavigate={onNavigate} onSelectSymptom={onSelectSymptom} />

        {/* 🔥 ストリーク（連続記録日数） */}
        <StreakCard />

        {/* ガイコツ先生の今日の一言（旬の食材・豆知識） */}
        <DailyTipCard />

        {/* 今日の食事ダッシュボード（週間カレンダー + 区分別サマリ） */}
        <TodayMealDashboard onGoToMealMode={onGoToMealMode} onOpenMeal={() => onNavigate("meal")} />

        {/* 通知設定（朝のチェックイン + ストレッチリマインダー） */}
        <div>
          <button
            onClick={() => setShowReminderSetting(!showReminderSetting)}
            className="text-xs text-gray-500 flex items-center gap-1"
          >
            🔔 通知設定: {morningNotifEnabled
              ? `朝 ${morningNotifHour}:${String(morningNotifMinute).padStart(2, "0")}`
              : reminderHours
              ? `${reminderHours}時間ごと`
              : "未設定"}
          </button>
        </div>

        {showReminderSetting && (
          <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-4">
            {/* ☀️ 朝のコンディションチェック通知 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white font-bold">☀️ 朝のコンディションチェック通知</p>
                  <p className="text-[11px] text-gray-400">毎朝、指定時刻にガイコツ先生がお知らせ</p>
                </div>
                <button
                  onClick={() => saveMorningNotifSettings(!morningNotifEnabled, morningNotifHour, morningNotifMinute)}
                  className={`relative w-12 h-6 rounded-full transition ${
                    morningNotifEnabled ? "bg-emerald-500" : "bg-gray-700"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${
                      morningNotifEnabled ? "left-6" : "left-0.5"
                    }`}
                  />
                </button>
              </div>
              {morningNotifEnabled && (
                <div className="flex items-center gap-2 pt-1">
                  <p className="text-xs text-gray-400">通知時刻:</p>
                  <select
                    value={morningNotifHour}
                    onChange={(e) => saveMorningNotifSettings(true, parseInt(e.target.value), morningNotifMinute)}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                  >
                    {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-400">:</span>
                  <select
                    value={morningNotifMinute}
                    onChange={(e) => saveMorningNotifSettings(true, morningNotifHour, parseInt(e.target.value))}
                    className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-sm text-white"
                  >
                    {[0, 15, 30, 45].map((m) => (
                      <option key={m} value={m}>
                        {String(m).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 pt-3">
              <p className="text-sm text-gray-300 mb-2 font-bold">💪 ストレッチリマインダー間隔</p>
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
                  onClick={() => { setReminderHours(null); localStorage.removeItem("zero_pain_reminder_hours"); cancelNativeNotification(); }}
                  className={`flex-1 py-2 rounded-lg text-sm ${
                    reminderHours === null ? "bg-gray-700 text-white" : "bg-gray-800 text-gray-400"
                  }`}
                >
                  OFF
                </button>
              </div>
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
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => onNavigate("history")}
              disabled={records.length === 0}
              className="btn-neutral px-3 py-3.5 flex flex-col items-center gap-1 disabled:opacity-40"
            >
              <span className="text-xl">📊</span>
              <p className="text-xs font-bold">履歴</p>
              <p className="text-[10px] text-gray-400 text-center leading-tight">
                {records.length > 0 ? `${records.length}件` : "記録なし"}
              </p>
            </button>
            <button
              onClick={() => onNavigate("before-after")}
              className="relative btn-neutral px-3 py-3.5 flex flex-col items-center gap-1 border-2 border-red-500/40"
            >
              <span className="absolute top-1 right-1.5 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-[0_2px_6px_rgba(239,68,68,0.4)]">
                NEW
              </span>
              <span className="text-xl">📸</span>
              <p className="text-xs font-bold">Before/After</p>
              <p className="text-[10px] text-gray-400 text-center leading-tight">
                変化を確認
              </p>
            </button>
          </div>
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

          {/* ガイコツ先生のプロフィールへ */}
          <button
            onClick={() => onNavigate("sensei-profile")}
            className="w-full flex items-center justify-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 py-1.5"
          >
            <span>💀</span>
            <span>ガイコツ先生について詳しく</span>
            <span>›</span>
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
                className={`relative rounded-2xl p-4 text-left transition-all active:scale-95 overflow-hidden bg-gradient-to-br ${symptom.gradientFrom} ${symptom.gradientTo} border-2 ${symptom.borderColor} shadow-md hover:shadow-xl`}
              >
                {/* 絵文字アイコン（円形グラデ背景） */}
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${symptom.iconBg} flex items-center justify-center text-2xl shadow-lg mb-2`}
                >
                  {symptom.emoji}
                </div>
                {/* タイトル */}
                <p className={`text-sm font-extrabold ${symptom.accentText} leading-tight`}>
                  {symptom.label}
                </p>
                {/* サブタイトル */}
                <p className="text-[10px] text-gray-600 mt-0.5 leading-snug line-clamp-2">
                  {symptom.subtitle}
                </p>
                {/* 右下矢印 */}
                <span className={`absolute bottom-2 right-3 text-sm ${symptom.accentText}`}>→</span>
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

function AiCounselScreen({
  onNavigate,
  onSelectSymptom,
  consultMeal,
  onMealConsumed,
}: {
  onNavigate: (s: Screen) => void;
  onSelectSymptom: (id: string) => void;
  consultMeal?: boolean;
  onMealConsumed?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendedId, setRecommendedId] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [attachedPhotoUrl, setAttachedPhotoUrl] = useState<string | null>(null);
  const [photoViewingBadge, setPhotoViewingBadge] = useState<string | null>(null);
  const [compareRequested, setCompareRequested] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // ストリーミングAPIを呼び出す共通関数
  const streamChat = async (
    apiMessages: ChatMessage[],
    onText: (delta: string) => void,
    extra?: {
      consultMeal?: boolean;
      attachedPhotoUrl?: string | null;
      compareMode?: boolean;
    }
  ): Promise<{ cleanText: string; recommendedSymptomId: string | null }> => {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: apiMessages.map((m) => ({ role: m.role, content: m.content })),
        deviceId: getDeviceId(),
        consultMeal: extra?.consultMeal === true,
        attachedPhotoUrl: extra?.attachedPhotoUrl || null,
        compareMode: extra?.compareMode === true,
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
      // 食事相談モードの場合、履歴を読まずに食事写真付きで開始
      // 姿勢写真が存在するかを先に取得して、バッジ表示の判定に使う
      try {
        const deviceId = getDeviceId();
        const baRes = await fetch(
          `/api/before-after?deviceId=${encodeURIComponent(deviceId || "")}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const baData = await baRes.json();
        if (baData.hasData && baData.latest) {
          const latestDate = new Date(baData.latest.createdAt);
          const daysAgo = Math.floor(
            (Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysAgo <= 3) {
            const dateLabel =
              daysAgo === 0
                ? "今日"
                : daysAgo === 1
                ? "昨日"
                : `${latestDate.getMonth() + 1}/${latestDate.getDate()}の姿勢写真`;
            setPhotoViewingBadge(dateLabel);
          }
        } else if (baData.firstRecord) {
          // 1枚しかない場合も表示
          const d = new Date(baData.firstRecord.createdAt);
          const daysAgo = Math.floor(
            (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24)
          );
          if (daysAgo <= 3) {
            setPhotoViewingBadge(
              daysAgo === 0 ? "今日" : `${d.getMonth() + 1}/${d.getDate()}の姿勢写真`
            );
          }
        }
      } catch {
        /* ignore */
      }

      if (consultMeal) {
        onMealConsumed?.();
        setLoading(true);
        setMessages([{ role: "assistant", content: "" }]);
        setPhotoViewingBadge("食事写真");
        let streamedText = "";
        try {
          const result = await streamChat(
            [],
            (delta) => {
              streamedText += delta;
              const display = streamedText.replace(/<recommendation>[\s\S]*$/, "");
              setMessages([{ role: "assistant", content: display }]);
            },
            { consultMeal: true }
          );
          if (result.cleanText) {
            setMessages([{ role: "assistant", content: result.cleanText }]);
          }
        } catch {
          setMessages([
            {
              role: "assistant",
              content: "食事の分析結果を見てアドバイスします。何か気になる点はありますか？",
            },
          ]);
        }
        setLoading(false);
        setHistoryLoaded(true);
        return;
      }

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

  // カメラで撮影した画像をSupabase Storageへアップロード
  const handlePhotoCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const compressedDataUrl = await compressImageToBase64(file, 1024);
      const res = await fetch("/api/chat/upload-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: getDeviceId(),
          imageData: compressedDataUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.imageUrl) {
        throw new Error(data.detail || data.error || "アップロードに失敗しました");
      }
      setAttachedPhotoUrl(data.imageUrl);
      setPhotoViewingBadge("今撮った姿勢写真");
      // プレースホルダーメッセージを自動入力
      if (!input.trim()) {
        setInput("今撮影した姿勢を見てください");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "アップロード失敗");
    } finally {
      setUploadingPhoto(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  // Before/After比較リクエスト
  const requestCompare = async () => {
    if (loading || uploadingPhoto) return;
    const userMsg: ChatMessage = {
      role: "user",
      content: "最初と最新の姿勢を比べて、変化と改善点を教えてください",
    };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setLoading(true);
    setCompareRequested(true);
    setPhotoViewingBadge("Before/After 比較中");

    let streamedText = "";
    try {
      const result = await streamChat(
        newMessages,
        (delta) => {
          streamedText += delta;
          const display = streamedText.replace(/<recommendation>[\s\S]*$/, "");
          setMessages([...newMessages, { role: "assistant", content: display }]);
        },
        { compareMode: true }
      );

      const finalText = result.cleanText || streamedText;
      setMessages([...newMessages, { role: "assistant", content: finalText }]);

      saveToDb({ type: "chat", role: "user", content: userMsg.content });
      saveToDb({
        type: "chat",
        role: "assistant",
        content: finalText,
        recommendedSymptom: result.recommendedSymptomId,
      });

      if (result.recommendedSymptomId) setRecommendedId(result.recommendedSymptomId);
    } catch {
      setMessages([
        ...newMessages,
        {
          role: "assistant",
          content: "すみません、比較分析中にエラーが発生しました。もう一度お試しください。",
        },
      ]);
    }
    setLoading(false);
  };

  const sendMessage = async () => {
    if ((!input.trim() && !attachedPhotoUrl) || loading) return;
    const userContent = input.trim() || "今撮影した姿勢を見てください";
    const userMsg: ChatMessage = { role: "user", content: userContent };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    // 写真を添付した場合はバッジ表示を維持（送信後にクリア）
    const photoForThisSend = attachedPhotoUrl;
    setAttachedPhotoUrl(null);

    let streamedText = "";
    try {
      const result = await streamChat(
        newMessages,
        (delta) => {
          streamedText += delta;
          const display = streamedText.replace(/<recommendation>[\s\S]*$/, "");
          setMessages([...newMessages, { role: "assistant", content: display }]);
        },
        { attachedPhotoUrl: photoForThisSend }
      );

      const finalText = result.cleanText || streamedText;
      setMessages([...newMessages, { role: "assistant", content: finalText }]);

      saveToDb({ type: "chat", role: "user", content: userMsg.content });
      saveToDb({
        type: "chat",
        role: "assistant",
        content: finalText,
        recommendedSymptom: result.recommendedSymptomId,
      });

      if (result.recommendedSymptomId) setRecommendedId(result.recommendedSymptomId);
      // 写真送信完了後はバッジ更新
      if (photoForThisSend) {
        setPhotoViewingBadge(null);
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
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => onNavigate("home")} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">← 戻る</button>
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-skeleton-sensei-face.png" alt="ガイコツ先生" className="w-10 h-10 object-contain" />
            <h1 className="text-base font-bold">ガイコツ先生のカウンセリング</h1>
          </div>
        </div>
        {/* 📸 Vision モードバッジ（写真を見ながら会話中の視覚フィードバック） */}
        {photoViewingBadge && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/30 to-purple-500/30 border border-indigo-400/50 rounded-full px-3 py-1">
            <span className="text-sm">📸</span>
            <span className="text-[11px] font-bold text-indigo-200">
              {photoViewingBadge}を見ながら応答中
            </span>
          </div>
        )}
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

      {/* 入力エリア（機能強化: カメラ撮影 + Before/After比較） */}
      <div className="border-t border-gray-800 max-w-md w-full mx-auto">
        {/* 隠しファイル入力（カメラ起動用） */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoCapture}
          className="hidden"
        />

        {/* 添付プレビュー（撮影後・送信前） */}
        {attachedPhotoUrl && (
          <div className="px-4 pt-3 pb-1">
            <div className="relative inline-flex items-center gap-2 bg-indigo-900/40 border border-indigo-500/40 rounded-xl p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={attachedPhotoUrl}
                alt="添付画像"
                className="w-12 h-12 object-cover rounded-lg"
              />
              <div className="pr-1">
                <p className="text-[11px] font-bold text-indigo-300">✅ 写真を添付しました</p>
                <p className="text-[10px] text-gray-400">送信すると分析します</p>
              </div>
              <button
                onClick={() => {
                  setAttachedPhotoUrl(null);
                  setPhotoViewingBadge(null);
                }}
                className="ml-1 w-6 h-6 bg-gray-800 hover:bg-gray-700 rounded-full flex items-center justify-center text-xs text-gray-400"
                aria-label="削除"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Before/After比較ボタン（まだ比較してない場合のみ表示） */}
        {!compareRequested && !attachedPhotoUrl && messages.length >= 1 && (
          <div className="px-4 pt-2">
            <button
              onClick={requestCompare}
              disabled={loading}
              className="w-full py-2 bg-gradient-to-r from-pink-500/20 to-purple-500/20 hover:from-pink-500/30 hover:to-purple-500/30 border border-pink-500/40 rounded-xl text-xs font-bold text-pink-200 flex items-center justify-center gap-2 active:scale-[0.98] transition"
            >
              <span className="text-base">⚖️</span>
              <span>Before / After を比較分析してもらう</span>
            </button>
          </div>
        )}

        <div className="px-4 py-3 flex gap-2 items-end">
          {/* カメラボタン */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={loading || uploadingPhoto}
            aria-label="カメラで撮影"
            className="w-11 h-11 flex-shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600 hover:brightness-110 disabled:opacity-50 rounded-xl flex items-center justify-center active:scale-95 transition"
          >
            <span className="text-xl">{uploadingPhoto ? "⏳" : "📷"}</span>
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !("isComposing" in e.nativeEvent && e.nativeEvent.isComposing)
              )
                sendMessage();
            }}
            placeholder={attachedPhotoUrl ? "写真について質問（任意）..." : "お悩みを入力..."}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500 text-sm"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || (!input.trim() && !attachedPhotoUrl)}
            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded-xl font-semibold text-sm"
          >
            送信
          </button>
        </div>
      </div>
    </main>
  );
}

// ==================== セルフケア画面（症状→動画） ====================
function SelfcareScreen({ onNavigate, initialSymptomId }: { onNavigate: (s: Screen) => void; initialSymptomId: string | null }) {
  const [selectedId, setSelectedId] = useState<string | null>(initialSymptomId);
  const [viewMode, setViewMode] = useState<"body" | "cards">("body");
  const activeSymptom = SYMPTOMS.find((s) => s.id === selectedId);
  const stretches = selectedId ? getStretchesBySymptom(selectedId) : [];

  // 選択された症状の詳細へスクロール
  const detailRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId && detailRef.current) {
      setTimeout(() => {
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [selectedId]);

  const handleSelect = (id: string) => {
    setSelectedId(selectedId === id ? null : id);
  };

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button onClick={() => onNavigate("home")} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 戻る</button>
        <h1 className="text-lg font-bold">セルフケア</h1>
      </div>

      {/* モード切替トグル */}
      <div className="w-full max-w-md mb-4">
        <div className="bg-gray-900/60 border border-gray-700/50 rounded-2xl p-1 flex relative">
          <button
            onClick={() => setViewMode("body")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative z-10 ${
              viewMode === "body" ? "text-white" : "text-gray-400"
            }`}
          >
            🧍 ボディマップ
          </button>
          <button
            onClick={() => setViewMode("cards")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative z-10 ${
              viewMode === "cards" ? "text-white" : "text-gray-400"
            }`}
          >
            📋 カード一覧
          </button>
          {/* スライドする背景 */}
          <div
            className="absolute top-1 bottom-1 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl transition-all duration-300 shadow-lg"
            style={{
              left: viewMode === "body" ? "4px" : "50%",
              right: viewMode === "body" ? "50%" : "4px",
            }}
          />
        </div>
      </div>

      <p className="text-gray-400 text-sm mb-4 w-full max-w-md text-center">
        {viewMode === "body"
          ? "気になる部位を人体図からタップしてください"
          : "気になる箇所を選んでください"}
      </p>

      {viewMode === "body" ? (
        <BodyMapView selectedId={selectedId} onSelect={handleSelect} />
      ) : (
        <ModernCardGrid selectedId={selectedId} onSelect={handleSelect} />
      )}

      {activeSymptom && stretches.length > 0 && (
        <div ref={detailRef} className="w-full max-w-md mt-6 space-y-4 scroll-mt-4">
          <div
            className={`rounded-2xl p-4 border-2 bg-gradient-to-br ${activeSymptom.gradientFrom} ${activeSymptom.gradientTo} ${activeSymptom.borderColor}`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${activeSymptom.iconBg} flex items-center justify-center text-2xl shadow-lg`}
              >
                {activeSymptom.emoji}
              </div>
              <div className="flex-1">
                <h3 className={`font-extrabold text-lg ${activeSymptom.accentText}`}>
                  {activeSymptom.label}のセルフケア
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  {stretches.length}種類 ・ {activeSymptom.subtitle}
                </p>
              </div>
            </div>
          </div>


          {stretches.map((stretch, i) => (
            <div
              key={stretch.id}
              className="rounded-2xl overflow-hidden border border-gray-200 bg-white shadow-lg"
            >
              {/* メインビジュアル（プロ品質インストラクション画像） */}
              <div className="relative w-full aspect-video overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={stretch.image}
                  alt={stretch.title}
                  className="w-full h-full object-cover block"
                  loading="lazy"
                />
                {/* 番号バッジ（画像の上に重ねる） */}
                <div
                  className={`absolute top-3 left-3 bg-gradient-to-r ${activeSymptom.iconBg} text-white text-xs font-extrabold px-3 py-1.5 rounded-full shadow-lg ring-2 ring-white/60`}
                >
                  {i + 1} / {stretches.length}
                </div>
              </div>

              {/* 補足情報 */}
              <div className="p-4 space-y-4 bg-white">
                {/* 時間・回数の要約バッジ */}
                <div className="flex flex-wrap gap-2">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-gradient-to-br ${activeSymptom.iconBg} text-white shadow-sm`}>
                    ⏱ {stretch.duration}
                  </span>
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white border-2 ${activeSymptom.borderColor} ${activeSymptom.accentText} shadow-sm`}>
                    🔄 {stretch.reps}
                  </span>
                </div>

                {/* 詳しいやり方（ステップ番号付き） */}
                <div>
                  <p className="text-sm font-extrabold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-lg">📋</span>
                    <span>詳しいやり方</span>
                  </p>
                  <ol className="space-y-2.5">
                    {stretch.steps.map((step, j) => (
                      <li key={j} className="flex gap-3 items-start">
                        <span
                          className={`flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br ${activeSymptom.iconBg} text-white font-extrabold flex items-center justify-center text-xs shadow-md`}
                        >
                          {j + 1}
                        </span>
                        <span className="text-sm text-gray-700 leading-relaxed pt-0.5">
                          {step}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* コツ */}
                <div className="bg-amber-50 border-l-4 border-amber-400 pl-3 py-2.5 pr-3 rounded-r-lg">
                  <p className="text-xs text-amber-700 font-extrabold mb-1 flex items-center gap-1">
                    <span>💡</span>
                    <span>ポイント</span>
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{stretch.tips}</p>
                </div>

                {/* 効果 */}
                <div
                  className={`bg-gradient-to-br ${activeSymptom.gradientFrom} ${activeSymptom.gradientTo} pl-3 py-2.5 pr-3 rounded-lg border ${activeSymptom.borderColor}`}
                >
                  <p className={`text-xs ${activeSymptom.accentText} font-extrabold mb-1 flex items-center gap-1`}>
                    <span>✨</span>
                    <span>効果</span>
                  </p>
                  <p className="text-sm text-gray-700 leading-relaxed">{stretch.benefit}</p>
                </div>
              </div>
            </div>
          ))}

          <button
            onClick={() => setSelectedId(null)}
            className="btn-neutral w-full py-3 text-sm"
          >
            閉じる
          </button>
        </div>
      )}
    </main>
  );
}

// ==================== 🧍 ボディマップビュー ====================
function BodyMapView({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const activeSymptom = SYMPTOMS.find((s) => s.id === selectedId);

  // ホットスポット（SVG上の位置とラベル）
  const hotspots: Array<{
    id: string;
    cx: number;
    cy: number;
    r: number;
    labelX: number;
    labelY: number;
    labelAnchor: "start" | "middle" | "end";
  }> = [
    { id: "headache", cx: 100, cy: 22, r: 9, labelX: 155, labelY: 22, labelAnchor: "start" },
    { id: "eye_fatigue", cx: 100, cy: 34, r: 6, labelX: 45, labelY: 34, labelAnchor: "end" },
    { id: "neck", cx: 100, cy: 52, r: 7, labelX: 155, labelY: 52, labelAnchor: "start" },
    { id: "shoulder_stiff", cx: 72, cy: 62, r: 9, labelX: 45, labelY: 62, labelAnchor: "end" },
    { id: "kyphosis", cx: 100, cy: 85, r: 9, labelX: 155, labelY: 85, labelAnchor: "start" },
    { id: "back", cx: 100, cy: 130, r: 9, labelX: 155, labelY: 130, labelAnchor: "start" },
  ];

  const symptomById = (id: string) => SYMPTOMS.find((s) => s.id === id);

  return (
    <div className="w-full max-w-md space-y-4">
      {/* ボディマップ */}
      <div className="relative bg-gradient-to-br from-gray-900/50 via-gray-900/30 to-gray-900/50 rounded-3xl p-4 border border-gray-700/30">
        <svg
          viewBox="0 0 200 260"
          className="w-full h-auto"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 人体シルエット（やわらかい・人間らしい） */}
          <defs>
            <linearGradient id="bodyGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ecfdf5" stopOpacity="1" />
              <stop offset="40%" stopColor="#d1fae5" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.85" />
            </linearGradient>
            <linearGradient id="headGradient" x1="50%" y1="0%" x2="50%" y2="100%">
              <stop offset="0%" stopColor="#ecfdf5" stopOpacity="1" />
              <stop offset="100%" stopColor="#a7f3d0" stopOpacity="0.9" />
            </linearGradient>
            <radialGradient id="pulseGradient">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.6" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </radialGradient>
            {/* ソフトシャドウフィルター */}
            <filter id="bodyShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
              <feOffset dx="0" dy="2" result="offsetblur" />
              <feFlood floodColor="#059669" floodOpacity="0.2" />
              <feComposite in2="offsetblur" operator="in" />
              <feMerge>
                <feMergeNode />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g filter="url(#bodyShadow)">
            {/* 統合された一筆書きのシルエット（人間らしい自然な曲線） */}
            <path
              d="
                M 100 14
                C 88 14 78 22 76 36
                C 74 44 77 50 80 52
                C 79 55 77 58 76 62
                C 74 64 72 64 68 65
                C 62 67 57 71 54 77
                C 50 85 49 96 50 108
                C 51 120 54 132 57 142
                C 58 147 63 149 66 146
                C 68 142 67 136 65 130
                C 63 122 61 112 62 102
                C 63 94 66 88 70 85
                C 72 98 74 112 75 125
                C 76 138 77 150 82 160
                C 84 165 85 172 85 180
                C 84 195 83 210 82 225
                C 81 232 80 238 80 244
                C 82 248 90 248 92 244
                C 93 238 93 230 94 220
                C 95 205 95 190 96 180
                C 97 176 98 175 100 175
                C 102 175 103 176 104 180
                C 105 190 105 205 106 220
                C 107 230 107 238 108 244
                C 110 248 118 248 120 244
                C 120 238 119 232 118 225
                C 117 210 116 195 115 180
                C 115 172 116 165 118 160
                C 123 150 124 138 125 125
                C 126 112 128 98 130 85
                C 134 88 137 94 138 102
                C 139 112 137 122 135 130
                C 133 136 132 142 134 146
                C 137 149 142 147 143 142
                C 146 132 149 120 150 108
                C 151 96 150 85 146 77
                C 143 71 138 67 132 65
                C 128 64 126 64 124 62
                C 123 58 121 55 120 52
                C 123 50 126 44 124 36
                C 122 22 112 14 100 14
                Z
              "
              fill="url(#bodyGradient)"
              stroke="#10b981"
              strokeWidth="1.2"
              strokeOpacity="0.55"
              strokeLinejoin="round"
            />

            {/* 顔の微妙な表情（親しみを演出：ほっぺの淡い影） */}
            <ellipse cx="88" cy="32" rx="3" ry="2" fill="#fecaca" opacity="0.5" />
            <ellipse cx="112" cy="32" rx="3" ry="2" fill="#fecaca" opacity="0.5" />
            {/* やさしい微笑み（口元） */}
            <path
              d="M 94 38 Q 100 41 106 38"
              fill="none"
              stroke="#047857"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.4"
            />
            {/* 髪のヒント（頭頂部のライン） */}
            <path
              d="M 82 18 Q 100 10 118 18"
              fill="none"
              stroke="#059669"
              strokeWidth="1.5"
              strokeOpacity="0.35"
              strokeLinecap="round"
            />
          </g>

          {/* ホットスポット（タップ可能領域） */}
          {hotspots.map((h) => {
            const symptom = symptomById(h.id);
            if (!symptom) return null;
            const isSelected = selectedId === h.id;
            const color =
              symptom.colorTheme === "emerald" ? "#10b981"
              : symptom.colorTheme === "teal" ? "#14b8a6"
              : symptom.colorTheme === "sky" ? "#0ea5e9"
              : symptom.colorTheme === "indigo" ? "#6366f1"
              : symptom.colorTheme === "rose" ? "#f43f5e"
              : "#f59e0b";

            return (
              <g key={h.id} style={{ color }}>
                {/* パルスアニメーション（選択時） */}
                {isSelected && (
                  <circle cx={h.cx} cy={h.cy} r={h.r + 6} fill="url(#pulseGradient)">
                    <animate
                      attributeName="r"
                      from={h.r}
                      to={h.r + 12}
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.8"
                      to="0"
                      dur="1.5s"
                      repeatCount="indefinite"
                    />
                  </circle>
                )}
                {/* タップエリア本体 */}
                <circle
                  cx={h.cx}
                  cy={h.cy}
                  r={h.r}
                  fill={color}
                  fillOpacity={isSelected ? 1 : 0.85}
                  stroke="#ffffff"
                  strokeWidth="2"
                  style={{ cursor: "pointer" }}
                  onClick={() => onSelect(h.id)}
                />
                {/* 絵文字 */}
                <text
                  x={h.cx}
                  y={h.cy + 3}
                  textAnchor="middle"
                  fontSize="9"
                  style={{ pointerEvents: "none" }}
                >
                  {symptom.emoji}
                </text>
                {/* ラベル（サイド表示） */}
                <text
                  x={h.labelX}
                  y={h.labelY + 3}
                  textAnchor={h.labelAnchor}
                  fontSize="10"
                  fontWeight="bold"
                  fill={color}
                  style={{ pointerEvents: "none" }}
                >
                  {symptom.label}
                </text>
                {/* ラインコネクター */}
                <line
                  x1={h.cx + (h.labelAnchor === "start" ? h.r : -h.r)}
                  y1={h.cy}
                  x2={h.labelX + (h.labelAnchor === "start" ? -3 : 3)}
                  y2={h.labelY}
                  stroke={color}
                  strokeWidth="1"
                  strokeOpacity="0.4"
                  strokeDasharray="2 2"
                  style={{ pointerEvents: "none" }}
                />
              </g>
            );
          })}
        </svg>

        {/* 凡例 */}
        <p className="text-[11px] text-center text-gray-500 mt-2">
          💡 色のついた点をタップすると、該当部位のケアが始まります
        </p>
      </div>

      {/* 選択中の症状 */}
      {activeSymptom && (
        <div
          className={`rounded-2xl p-4 border-2 bg-gradient-to-br ${activeSymptom.gradientFrom} ${activeSymptom.gradientTo} ${activeSymptom.borderColor} animate-slide-up-fade`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-12 h-12 rounded-xl bg-gradient-to-br ${activeSymptom.iconBg} flex items-center justify-center text-xl shadow-lg`}
            >
              {activeSymptom.emoji}
            </div>
            <div className="flex-1">
              <p className={`text-base font-extrabold ${activeSymptom.accentText}`}>
                {activeSymptom.label}
              </p>
              <p className="text-xs text-gray-600">{activeSymptom.subtitle}</p>
            </div>
            <span className={`text-2xl ${activeSymptom.accentText}`}>→</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 📋 モダンカードグリッド ====================
function ModernCardGrid({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="w-full max-w-md grid grid-cols-2 gap-3">
      {SYMPTOMS.map((symptom) => {
        const stretches = getStretchesBySymptom(symptom.id);
        const isSelected = selectedId === symptom.id;
        return (
          <button
            key={symptom.id}
            onClick={() => onSelect(symptom.id)}
            className={`relative rounded-2xl p-4 text-left transition-all active:scale-95 overflow-hidden bg-gradient-to-br ${symptom.gradientFrom} ${symptom.gradientTo} border-2 ${
              isSelected ? symptom.borderColor : "border-transparent"
            } shadow-lg hover:shadow-xl`}
          >
            {/* 絵文字アイコン（大きめ・円形グラデ背景） */}
            <div
              className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${symptom.iconBg} flex items-center justify-center text-3xl shadow-lg mb-3`}
            >
              {symptom.emoji}
            </div>

            {/* タイトル */}
            <p className={`text-base font-extrabold ${symptom.accentText} leading-tight`}>
              {symptom.label}
            </p>

            {/* サブタイトル */}
            <p className="text-[11px] text-gray-600 mt-1 leading-snug line-clamp-2">
              {symptom.subtitle}
            </p>

            {/* メタ情報 */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/60 ${symptom.accentText}`}>
                {stretches.length}種類
              </span>
              <span className="text-[10px] text-gray-500">
                5〜10分
              </span>
            </div>

            {/* 選択中インジケーター */}
            {isSelected && (
              <div
                className={`absolute top-2 right-2 w-6 h-6 rounded-full bg-gradient-to-br ${symptom.iconBg} flex items-center justify-center text-white text-xs font-bold shadow-lg`}
              >
                ✓
              </div>
            )}
          </button>
        );
      })}
    </div>
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
  const [showFirstCheckCelebration, setShowFirstCheckCelebration] = useState(false);
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

    // 🎉 初回の姿勢チェックなら祝福演出を表示
    if (typeof window !== "undefined") {
      const pending = localStorage.getItem("zero_pain_first_check_pending");
      if (pending === "1") {
        localStorage.removeItem("zero_pain_first_check_pending");
        setShowFirstCheckCelebration(true);
      }
    }
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

      {/* 🎉 初回チェック祝福モーダル */}
      {showFirstCheckCelebration && (
        <FirstCheckCelebrationModal
          onClose={() => {
            setShowFirstCheckCelebration(false);
          }}
          onGoHome={() => {
            setShowFirstCheckCelebration(false);
            onNavigate("home");
          }}
          onOpenBeforeAfter={() => {
            setShowFirstCheckCelebration(false);
            onNavigate("before-after");
          }}
        />
      )}
    </main>
  );
}

// ==================== 🎉 初回姿勢チェック祝福モーダル ====================
function FirstCheckCelebrationModal({
  onClose,
  onGoHome,
  onOpenBeforeAfter,
}: {
  onClose: () => void;
  onGoHome: () => void;
  onOpenBeforeAfter: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* 紙吹雪アニメーション（CSSベース） */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute text-2xl animate-confetti"
            style={{
              left: `${Math.random() * 100}%`,
              top: `-10%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${3 + Math.random() * 2}s`,
            }}
          >
            {["✨", "🎉", "🦴", "🌟", "💫"][i % 5]}
          </div>
        ))}
      </div>

      <div
        className="relative w-full max-w-sm bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-6 shadow-2xl space-y-4 animate-slide-up-fade"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-skeleton-sensei-face.png"
            alt="ガイコツ先生"
            className="w-24 h-24 mx-auto object-contain drop-shadow-lg"
          />
          <div>
            <p className="text-xs font-bold text-yellow-300 tracking-widest mb-1">
              🎉 ACHIEVEMENT UNLOCKED
            </p>
            <h2 className="text-2xl font-extrabold text-white leading-tight">
              はじめての姿勢チェック完了！
            </h2>
            <p className="text-sm text-indigo-100 mt-2">
              🌱 バッジ獲得: <span className="font-bold">はじめの一歩</span>
            </p>
          </div>
        </div>

        <div className="bg-black/30 rounded-2xl p-4 space-y-2">
          <p className="text-sm text-white leading-relaxed">
            ✨ 今日の写真は<span className="font-bold text-yellow-300">&ldquo;Before写真&rdquo;</span>
            として保存されました。
          </p>
          <p className="text-xs text-indigo-100 leading-relaxed">
            継続するほど、体の変化がはっきり見えてきます。
            1ヶ月後のあなたが楽しみですね。
          </p>
        </div>

        <div className="space-y-2">
          <button
            onClick={onOpenBeforeAfter}
            className="w-full py-3 bg-white text-indigo-700 rounded-xl font-extrabold shadow-lg active:scale-[0.98] transition"
          >
            📸 Before写真を確認する
          </button>
          <button
            onClick={onGoHome}
            className="w-full py-2.5 bg-white/20 hover:bg-white/30 text-white rounded-xl font-bold transition"
          >
            ホームに戻る
          </button>
        </div>
      </div>
    </div>
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

// ==================== お祝いアニメーションモーダル ====================
function CelebrationModal({
  badge,
  streakDays,
  onClose,
}: {
  badge: { emoji: string; title: string; days: number };
  streakDays: number;
  onClose: () => void;
}) {
  // 紙吹雪用: 30個のカラフルな絵文字をランダム配置
  const confettiEmojis = ["🎉", "✨", "🎊", "⭐", "💫", "🌟", "🎀", "💎"];
  const confettiColors = [
    "#fbbf24", // amber
    "#34d399", // emerald
    "#60a5fa", // blue
    "#f472b6", // pink
    "#a78bfa", // violet
    "#fb923c", // orange
  ];
  const confettiPieces = Array.from({ length: 40 }).map((_, i) => ({
    id: i,
    left: Math.random() * 100, // 0-100%
    delay: Math.random() * 1.5, // 0-1.5s
    duration: 2.5 + Math.random() * 2, // 2.5-4.5s
    emoji: confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)],
    color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    size: 12 + Math.random() * 20, // 12-32px
  }));

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/90 backdrop-blur-md flex items-center justify-center p-6 overflow-hidden"
      onClick={onClose}
    >
      {/* 紙吹雪 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {confettiPieces.map((p) => (
          <span
            key={p.id}
            className="absolute top-0"
            style={{
              left: `${p.left}%`,
              color: p.color,
              fontSize: `${p.size}px`,
              animation: `confetti-fall ${p.duration}s linear ${p.delay}s infinite`,
            }}
          >
            {p.emoji}
          </span>
        ))}
      </div>

      {/* 中央のコンテンツ */}
      <div
        className="relative z-10 w-full max-w-sm text-center space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 光の背景 */}
        <div className="relative mx-auto w-48 h-48">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-500 via-red-500 to-pink-500 blur-2xl animate-glow-pulse" />
          <div className="relative w-full h-full flex items-center justify-center animate-badge-pop">
            <span className="text-[120px] drop-shadow-[0_0_20px_rgba(251,191,36,0.8)]">
              {badge.emoji}
            </span>
          </div>
        </div>

        {/* バッジ名 */}
        <div className="animate-slide-up-fade" style={{ animationDelay: "0.4s", opacity: 0 }}>
          <p className="text-amber-300 font-bold text-base tracking-wide mb-2">
            🎊 バッジを獲得しました 🎊
          </p>
          <h2 className="text-3xl font-extrabold text-white mb-2 drop-shadow-lg">
            {badge.title}
          </h2>
          <p className="text-base text-gray-200">
            <span className="text-4xl font-extrabold text-amber-300 mx-1">
              {streakDays}
            </span>
            日連続達成！
          </p>
        </div>

        {/* ガイコツ先生のメッセージ */}
        <div
          className="animate-slide-up-fade card-accent-amber p-4"
          style={{ animationDelay: "0.7s", opacity: 0 }}
        >
          <div className="flex items-start gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-skeleton-sensei-face.png"
              alt="ガイコツ先生"
              className="w-12 h-12 object-contain flex-shrink-0"
            />
            <div className="flex-1 text-left">
              <p className="text-[11px] text-amber-400 font-bold">
                ガイコツ先生より
              </p>
              <p className="text-sm text-white leading-relaxed mt-1">
                {getCelebrationMessage(badge.days)}
              </p>
            </div>
          </div>
        </div>

        {/* シェア + OKボタン */}
        <div className="animate-slide-up-fade space-y-2" style={{ animationDelay: "1.0s", opacity: 0 }}>
          <button
            onClick={async () => {
              const shareText = `🎉 ZERO-PAINで「${badge.title}」バッジを獲得しました！${streakDays}日連続記録達成 ${badge.emoji}🔥\n\n姿勢チェックと食事記録でガイコツ先生と一緒に健康習慣を続けています✨\n\nhttps://posture-app-steel.vercel.app`;
              if (typeof navigator === "undefined") return;
              const nav = navigator as Navigator & {
                share?: (d: ShareData) => Promise<void>;
                clipboard?: { writeText: (s: string) => Promise<void> };
              };
              if (nav.share) {
                try {
                  await nav.share({
                    title: `🎉 ${badge.title} 獲得！`,
                    text: shareText,
                  });
                } catch { /* user cancelled */ }
              } else if (nav.clipboard) {
                try {
                  await nav.clipboard.writeText(shareText);
                  alert("✅ シェア用テキストをコピーしました！");
                } catch { /* ignore */ }
              }
            }}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-red-500 hover:from-amber-400 hover:to-red-400 rounded-2xl text-base font-bold text-white shadow-[0_8px_24px_rgba(245,158,11,0.45)]"
          >
            📤 この達成を友達にシェア
          </button>
          <button
            onClick={onClose}
            className="btn-neutral w-full py-3 text-sm"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}

function getCelebrationMessage(days: number): string {
  const messages: Record<number, string> = {
    3: "素晴らしいスタートです！3日続けばもう習慣化の入り口。この調子でいきましょう🌱",
    7: "1週間連続達成、おめでとうございます！これで健康習慣の基礎ができました🔥",
    14: "2週間継続は本当に立派です。多くの人がここで脱落します。あなたは違いますね⭐",
    30: "1ヶ月連続！これはもう立派な習慣です。体の変化を感じ始めていませんか？💎",
    50: "50日継続、頭が下がります。あなたはもう達人クラスです🏆",
    100: "驚異の3桁達成者！ZERO-PAIN利用者の中でも本当に上位層です👑",
    200: "200日連続は鉄人の域。健康が生活の一部になっていますね🌟",
    365: "1年連続達成！伝説級の継続力です。本当におめでとうございます🎊",
  };
  return messages[days] || `${days}日連続、お見事です！この調子で続けていきましょう🔥`;
}

// ==================== ストリーク（連続記録日数） ====================
type StreakBadge = {
  days: number;
  emoji: string;
  title: string;
  unlocked: boolean;
};

type StreakData = {
  currentStreak: number;
  longestStreak: number;
  totalActiveDays: number;
  activeToday: boolean;
  lastActiveDate: string | null;
  nextBadge: StreakBadge;
  unlockedBadges: StreakBadge[];
  badges: StreakBadge[];
  dateMap: Record<string, boolean>;
};

// ストリーク維持のための夜リマインダー通知をスケジュール（控えめ・1日1回）
async function scheduleStreakReminder(data: StreakData) {
  if (typeof window === "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cap = (window as any).Capacitor;
    const isNative = cap?.isNativePlatform?.() === true;

    // メッセージは状況に応じて変化
    let title: string;
    let body: string;

    if (data.currentStreak > 0 && !data.activeToday) {
      // 危機：今日まだ記録なし
      title = `⚠️ ${data.currentStreak}日連続記録が途絶えそう！`;
      body = `今日中に姿勢チェックか食事記録を1つすれば${data.currentStreak + 1}日連続達成です 🔥`;
    } else if (data.currentStreak > 0 && data.activeToday) {
      // 達成済：応援メッセージ
      const daysToNext = data.nextBadge.days - data.currentStreak;
      title = `🔥 ${data.currentStreak}日連続達成中！`;
      body =
        daysToNext > 0
          ? `次のバッジ「${data.nextBadge.title}」まであと${daysToNext}日です ${data.nextBadge.emoji}`
          : `素晴らしい継続力です！明日も楽しく記録しましょう ✨`;
    } else {
      title = "🌱 ZERO-PAINで健康習慣";
      body = "今日の姿勢チェックや食事記録をして連続記録を始めましょう！";
    }

    // 今日の20:30（JST）を計算
    const now = new Date();
    const target = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      20,
      30,
      0
    );
    // すでに過ぎていたら翌日に
    if (target.getTime() <= now.getTime()) {
      target.setDate(target.getDate() + 1);
    }

    if (isNative) {
      // Capacitor環境（iOSネイティブ）
      const { LocalNotifications } = await import(
        "@capacitor/local-notifications"
      );
      // 既存のストリーク通知（ID: 2）をキャンセル
      await LocalNotifications.cancel({ notifications: [{ id: 2 }] });
      // 権限チェック
      const perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return;
      await LocalNotifications.schedule({
        notifications: [
          {
            id: 2,
            title,
            body,
            schedule: {
              at: target,
              repeats: true,
              every: "day",
            },
            sound: "default",
          },
        ],
      });
    } else {
      // Web環境: Notification API（ページ閉じられていると届かないので簡易版）
      if (!("Notification" in window)) return;
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
      // Web環境は通知スケジュールできないので、次回訪問時にチェックする方式にする
      // ここでは権限要求だけ
    }
  } catch (err) {
    console.warn("[streak] reminder scheduling failed:", err);
  }
}

function StreakCard() {
  const [data, setData] = useState<StreakData | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [celebrationBadge, setCelebrationBadge] = useState<StreakBadge | null>(null);

  const fetchStreak = useCallback(async () => {
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/streak?deviceId=${encodeURIComponent(deviceId || "")}`,
        { cache: "no-store" }
      );
      const d = await res.json();
      if (res.ok) {
        setData(d);
        // 新しく達成したバッジを検知してお祝い表示
        checkForNewBadgeAchievement(d);
      }
    } catch { /* ignore */ }
  }, []);

  // LocalStorageに獲得済みバッジを保存し、新規獲得時のみお祝いを出す
  const checkForNewBadgeAchievement = (d: StreakData) => {
    if (typeof window === "undefined") return;
    const celebratedKey = "zero_pain_celebrated_badges";
    const celebratedRaw = localStorage.getItem(celebratedKey);
    const celebrated: number[] = celebratedRaw ? JSON.parse(celebratedRaw) : [];

    // 新しく獲得したバッジを探す
    const newlyUnlocked = d.unlockedBadges.find(
      (b) => !celebrated.includes(b.days)
    );

    if (newlyUnlocked) {
      // 少し遅延してから祝う（画面描画後）
      setTimeout(() => setCelebrationBadge(newlyUnlocked), 500);
      // 獲得済みに追加して保存
      localStorage.setItem(
        celebratedKey,
        JSON.stringify([...celebrated, newlyUnlocked.days])
      );
    }
  };

  useEffect(() => {
    fetchStreak();
    const onVis = () => {
      if (document.visibilityState === "visible") fetchStreak();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", fetchStreak);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", fetchStreak);
    };
  }, [fetchStreak]);

  // ストリーク維持のための夜リマインダー通知（1日1回 20:30）
  useEffect(() => {
    if (!data) return;
    scheduleStreakReminder(data);
  }, [data]);

  if (!data) return null;

  // ストリーク0日の場合は導入カード表示
  if (data.currentStreak === 0 && data.longestStreak === 0) {
    return (
      <div className="card-base p-4 relative overflow-hidden">
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/70" />
        <div className="flex items-start gap-3 pl-2">
          <span className="text-3xl">🔥</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white mb-1">
              連続記録を始めましょう
            </p>
            <p className="text-xs text-gray-300 leading-relaxed">
              今日、姿勢チェック・食事記録・ガイコツ先生への相談のいずれかをすると、
              連続記録日数がカウントスタートします 🎯
            </p>
          </div>
        </div>
      </div>
    );
  }

  const progressToNext =
    data.nextBadge && data.currentStreak < data.nextBadge.days
      ? (data.currentStreak / data.nextBadge.days) * 100
      : 100;
  const daysToNext = data.nextBadge.days - data.currentStreak;

  return (
    <>
      <button
        onClick={() => setShowDetail(true)}
        className="w-full card-base p-4 relative overflow-hidden active:scale-[0.99] transition text-left"
      >
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-amber-500/70" />
        <div className="flex items-center gap-3 pl-2">
          {/* 大きな炎アイコン + 日数 */}
          <div className="flex items-baseline gap-1 flex-shrink-0">
            <span className="text-3xl">🔥</span>
            <span className="text-3xl font-extrabold text-amber-300">
              {data.currentStreak}
            </span>
            <span className="text-sm font-bold text-amber-300">日</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-amber-400 font-bold tracking-wide">
              {data.activeToday ? "連続記録中" : "続けて達成！"}
            </p>
            {data.nextBadge && data.currentStreak < data.nextBadge.days ? (
              <>
                <p className="text-xs text-gray-300 mt-0.5 leading-tight">
                  次のバッジまで <strong className="text-white">あと{daysToNext}日</strong>
                </p>
                {/* プログレスバー */}
                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-red-500 transition-all"
                    style={{ width: `${progressToNext}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  {data.nextBadge.emoji} {data.nextBadge.title}
                </p>
              </>
            ) : (
              <p className="text-xs text-gray-300 mt-0.5">
                最長記録: {data.longestStreak}日 / 累計{data.totalActiveDays}日
              </p>
            )}
          </div>

          <span className="text-gray-500 text-lg">›</span>
        </div>

        {/* 今日未達成の警告 */}
        {!data.activeToday && data.currentStreak > 0 && (
          <div className="mt-3 pl-2 text-[11px] text-red-300 bg-red-500/10 border border-red-500/30 rounded-md px-2 py-1.5">
            ⚠️ 今日まだ記録がありません。今日中に1つ記録すれば{data.currentStreak}日連続が継続します！
          </div>
        )}
      </button>

      {/* 詳細モーダル */}
      {showDetail && (
        <StreakDetailModal data={data} onClose={() => setShowDetail(false)} />
      )}

      {/* 🎉 お祝いアニメーション（マイルストーン達成時） */}
      {celebrationBadge && (
        <CelebrationModal
          badge={celebrationBadge}
          streakDays={data.currentStreak}
          onClose={() => setCelebrationBadge(null)}
        />
      )}
    </>
  );
}

type RankingData = {
  myStreak: number;
  totalUsers: number;
  rank: number;
  percentile: number;
  activeUsersToday: number;
  averageStreak: number;
  medianStreak: number;
  topStreakDistribution: Array<{ range: string; count: number; isMe: boolean }>;
};

function StreakDetailModal({
  data,
  onClose,
}: {
  data: StreakData;
  onClose: () => void;
}) {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [rankingLoading, setRankingLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const deviceId = getDeviceId();
        const res = await fetch(
          `/api/streak/ranking?deviceId=${encodeURIComponent(deviceId || "")}`,
          { cache: "no-store" }
        );
        const d = await res.json();
        if (res.ok) setRanking(d);
      } catch { /* ignore */ }
      setRankingLoading(false);
    })();
  }, []);
  // 直近30日のカレンダー（JST日付 YYYY-MM-DD の配列）
  const last30Days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const jst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
    const key = `${jst.getUTCFullYear()}-${String(jst.getUTCMonth() + 1).padStart(2, "0")}-${String(jst.getUTCDate()).padStart(2, "0")}`;
    last30Days.push(key);
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto bg-gray-900 border border-white/10 rounded-3xl p-5 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
            🔥 <span>連続記録</span>
          </h2>
          <button onClick={onClose} className="text-gray-400 text-2xl">
            ✕
          </button>
        </div>

        {/* 大きな数字表示 */}
        <div className="card-accent-amber p-5 text-center">
          <p className="text-[11px] text-amber-300 font-bold tracking-wide">
            現在の連続記録
          </p>
          <div className="flex items-baseline justify-center gap-1 mt-1">
            <span className="text-5xl">🔥</span>
            <span className="text-6xl font-extrabold text-amber-300">
              {data.currentStreak}
            </span>
            <span className="text-2xl font-bold text-amber-300">日</span>
          </div>
          <p className="text-xs text-gray-300 mt-2">
            {data.activeToday
              ? "✅ 今日も記録達成！"
              : "⏰ 今日の記録をお忘れなく"}
          </p>
        </div>

        {/* 統計 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="card-base p-3 text-center">
            <p className="text-[10px] text-gray-400">最長記録</p>
            <p className="text-xl font-extrabold text-white mt-1">
              {data.longestStreak}
              <span className="text-[10px] ml-0.5 font-normal">日</span>
            </p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-[10px] text-gray-400">累計</p>
            <p className="text-xl font-extrabold text-white mt-1">
              {data.totalActiveDays}
              <span className="text-[10px] ml-0.5 font-normal">日</span>
            </p>
          </div>
          <div className="card-base p-3 text-center">
            <p className="text-[10px] text-gray-400">獲得バッジ</p>
            <p className="text-xl font-extrabold text-white mt-1">
              {data.unlockedBadges.length}
              <span className="text-[10px] ml-0.5 font-normal">個</span>
            </p>
          </div>
        </div>

        {/* 直近30日カレンダー */}
        <div>
          <p className="text-[11px] text-gray-400 font-bold mb-2 tracking-wide">
            📅 直近30日の記録
          </p>
          <div className="grid grid-cols-10 gap-1">
            {last30Days.map((key, i) => {
              const active = data.dateMap[key];
              const isToday = i === 29;
              return (
                <div
                  key={key}
                  className={`aspect-square rounded-md flex items-center justify-center text-[10px] font-bold ${
                    active
                      ? isToday
                        ? "bg-gradient-to-br from-amber-500 to-red-500 text-white"
                        : "bg-emerald-600/60 text-white"
                      : "bg-gray-800 text-gray-600"
                  }`}
                  title={key}
                >
                  {active ? "🔥" : "·"}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-500 mt-1.5 text-right">
            左: 30日前 → 右: 今日
          </p>
        </div>

        {/* 🏆 匿名ランキング（プライバシー保護・上位%表示） */}
        {!rankingLoading && ranking && ranking.totalUsers >= 3 && (
          <div>
            <p className="text-[11px] text-gray-400 font-bold mb-2 tracking-wide">
              🏆 全ユーザー中のあなたの位置
            </p>
            <div className="card-accent-indigo p-4 space-y-3">
              {/* パーセンタイル表示 */}
              <div className="text-center">
                <p className="text-[11px] text-indigo-300">あなたの連続記録は</p>
                <p className="text-3xl font-extrabold text-white mt-1">
                  上位{" "}
                  <span className="text-indigo-300">
                    {ranking.percentile}
                  </span>
                  <span className="text-lg">%</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-1">
                  {ranking.totalUsers}人中 {ranking.rank}位
                </p>
              </div>

              {/* 分布グラフ */}
              <div className="space-y-1.5">
                <p className="text-[11px] text-gray-400 mb-1">
                  📊 ユーザー分布（あなたの位置: 🔥）
                </p>
                {ranking.topStreakDistribution.map((d) => {
                  const maxCount = Math.max(
                    ...ranking.topStreakDistribution.map((x) => x.count)
                  );
                  const widthPct =
                    maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                  return (
                    <div
                      key={d.range}
                      className="flex items-center gap-2 text-[11px]"
                    >
                      <span className="w-20 text-right text-gray-300">
                        {d.range}
                      </span>
                      <div className="flex-1 h-5 bg-gray-800 rounded overflow-hidden relative">
                        <div
                          className={`h-full ${
                            d.isMe
                              ? "bg-gradient-to-r from-amber-500 to-red-500"
                              : "bg-indigo-500/50"
                          }`}
                          style={{ width: `${widthPct}%` }}
                        />
                        {d.isMe && (
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm">
                            🔥
                          </span>
                        )}
                      </div>
                      <span className="w-8 text-right text-gray-400">
                        {d.count}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 追加統計 */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">今日記録</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {ranking.activeUsersToday}
                    <span className="text-[10px] font-normal">人</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">平均</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {ranking.averageStreak}
                    <span className="text-[10px] font-normal">日</span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-gray-400">中央値</p>
                  <p className="text-sm font-bold text-white mt-0.5">
                    {ranking.medianStreak}
                    <span className="text-[10px] font-normal">日</span>
                  </p>
                </div>
              </div>

              <p className="text-[10px] text-gray-500 text-center leading-relaxed pt-1">
                ※ 他のユーザーの個人情報は一切公開されません
                <br />
                プライバシー完全保護
              </p>
            </div>
          </div>
        )}

        {/* バッジ一覧 */}
        <div>
          <p className="text-[11px] text-gray-400 font-bold mb-2 tracking-wide">
            🏆 バッジコレクション
          </p>
          <div className="grid grid-cols-2 gap-2">
            {data.badges.map((b) => (
              <div
                key={b.days}
                className={`rounded-xl p-3 flex items-center gap-2 ${
                  b.unlocked
                    ? "card-accent-amber"
                    : "card-base opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl">{b.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-xs font-bold ${
                      b.unlocked ? "text-white" : "text-gray-500"
                    }`}
                  >
                    {b.title}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {b.days}日連続
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 次の目標 */}
        {data.currentStreak < data.nextBadge.days && (
          <div className="card-base p-4 text-center">
            <p className="text-xs text-gray-400">次の目標</p>
            <p className="text-2xl mt-1">{data.nextBadge.emoji}</p>
            <p className="text-sm font-bold text-white mt-1">
              {data.nextBadge.title}
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              あと {data.nextBadge.days - data.currentStreak} 日！
            </p>
          </div>
        )}

        <button onClick={onClose} className="btn-primary w-full py-3 text-sm">
          閉じる
        </button>
      </div>
    </div>
  );
}

// ==================== ☀️ 朝のコンディションチェック ====================
type SelectableSymptomId =
  | "neck"
  | "shoulder_stiff"
  | "shoulder_pain"
  | "back"
  | "headache"
  | "eye_fatigue"
  | "kyphosis";

interface CheckinData {
  id: string;
  mood_level: number;
  ai_message: string | null;
  recommended_care: Array<{
    symptomId: string;
    title: string;
    reason: string;
  }> | null;
  checkin_date: string;
}

function MorningCheckinCard({
  onNavigate,
  onSelectSymptom,
  morningNotifEnabled,
  onEnableMorningNotif,
}: {
  onNavigate: (s: Screen) => void;
  onSelectSymptom: (id: SelectableSymptomId) => void;
  morningNotifEnabled: boolean;
  onEnableMorningNotif: () => Promise<void>;
}) {
  const [loading, setLoading] = useState(true);
  const [hasToday, setHasToday] = useState(false);
  const [checkin, setCheckin] = useState<CheckinData | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [daysSinceRegistration, setDaysSinceRegistration] = useState(0);
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [bodyNote, setBodyNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showNudge, setShowNudge] = useState(false);
  const [enablingNotif, setEnablingNotif] = useState(false);

  // 通知誘導バナーの表示判定（チェックイン後 + 通知未設定 + 7日以内に却下されていない）
  useEffect(() => {
    if (!hasToday) return;
    if (morningNotifEnabled) {
      setShowNudge(false);
      return;
    }
    const dismissedAt = localStorage.getItem("zero_pain_morning_nudge_dismissed_at");
    const now = Date.now();
    if (dismissedAt && now - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
      setShowNudge(false);
      return;
    }
    setShowNudge(true);
  }, [hasToday, morningNotifEnabled]);

  const dismissNudge = () => {
    localStorage.setItem("zero_pain_morning_nudge_dismissed_at", String(Date.now()));
    setShowNudge(false);
  };

  const enableNotif = async () => {
    setEnablingNotif(true);
    try {
      await onEnableMorningNotif();
      setShowNudge(false);
    } finally {
      setEnablingNotif(false);
    }
  };

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/checkin?deviceId=${encodeURIComponent(deviceId || "")}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      setHasToday(!!data.hasToday);
      setCheckin(data.checkin || null);
      setUserName(data.userName || null);
      setDaysSinceRegistration(data.daysSinceRegistration || 0);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const submit = async () => {
    if (!selectedMood) return;
    setSubmitting(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId,
          moodLevel: selectedMood,
          bodyNote: bodyNote.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "保存に失敗しました");
      }
      await loadStatus();
      setBodyNote("");
      setShowNoteInput(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  };

  // 関係性レベルでの挨拶（chat/route.ts の閾値と統一: 3日/14日/30日）
  const greeting = useMemo(() => {
    const name = userName || "あなた";
    if (daysSinceRegistration === 0) {
      return `はじめまして、${name}さん`;
    } else if (daysSinceRegistration <= 3) {
      return `おはようございます、${name}さん`;
    } else if (daysSinceRegistration <= 14) {
      return `おはよう、${name}さん！`;
    } else if (daysSinceRegistration <= 30) {
      return `${name}さん、今日もよろしくね`;
    } else {
      return `${name}さん、今日も一緒にがんばろう`;
    }
  }, [userName, daysSinceRegistration]);

  const moodOptions: Array<{ level: number; emoji: string; label: string; color: string }> = [
    { level: 1, emoji: "😫", label: "つらい", color: "from-red-600/30 to-red-700/20 border-red-500/50" },
    { level: 2, emoji: "😕", label: "いまいち", color: "from-orange-600/30 to-orange-700/20 border-orange-500/50" },
    { level: 3, emoji: "😐", label: "普通", color: "from-gray-600/30 to-gray-700/20 border-gray-500/50" },
    { level: 4, emoji: "🙂", label: "いい", color: "from-emerald-600/30 to-emerald-700/20 border-emerald-500/50" },
    { level: 5, emoji: "😄", label: "絶好調", color: "from-yellow-500/30 to-amber-600/20 border-yellow-400/60" },
  ];

  if (loading) {
    return (
      <div className="card-base p-4 animate-pulse">
        <div className="h-5 w-32 bg-gray-800 rounded mb-2" />
        <div className="h-12 w-full bg-gray-800 rounded" />
      </div>
    );
  }

  // ========= すでに今日チェックイン済み =========
  if (hasToday && checkin) {
    const moodInfo = moodOptions.find((m) => m.level === checkin.mood_level);
    return (
      <div className={`relative overflow-hidden rounded-2xl p-4 border bg-gradient-to-br ${moodInfo?.color || "from-gray-800 to-gray-900 border-gray-700"}`}>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-skeleton-sensei-face.png"
            alt="ガイコツ先生"
            className="w-11 h-11 object-contain flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{moodInfo?.emoji}</span>
              <p className="text-xs text-gray-300 font-bold tracking-wide">
                今日のコンディション: {moodInfo?.label}
              </p>
            </div>
            {checkin.ai_message && (
              <p className="text-sm text-white leading-relaxed">
                {checkin.ai_message}
              </p>
            )}
          </div>
        </div>
        {/* おすすめケア */}
        {checkin.recommended_care && checkin.recommended_care.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wide">
              💡 今日のおすすめケア
            </p>
            {checkin.recommended_care.map((care, i) => (
              <button
                key={i}
                onClick={() => {
                  const id = care.symptomId as SelectableSymptomId;
                  if (["neck", "shoulder_stiff", "shoulder_pain", "back", "headache", "eye_fatigue", "kyphosis"].includes(id)) {
                    onSelectSymptom(id);
                  } else {
                    onNavigate("selfcare");
                  }
                }}
                className="w-full bg-black/30 hover:bg-black/50 border border-white/10 rounded-xl px-3 py-2 flex items-center justify-between transition active:scale-[0.98]"
              >
                <div className="text-left">
                  <p className="text-sm font-bold text-white">{care.title}</p>
                  <p className="text-[11px] text-gray-300">{care.reason}</p>
                </div>
                <span className="text-emerald-400 text-lg">→</span>
              </button>
            ))}
          </div>
        )}

        {/* 🔔 通知誘導バナー（通知未設定 + 一度だけ表示） */}
        {showNudge && (
          <div className="mt-3 bg-gradient-to-r from-indigo-600/30 to-purple-600/20 border border-indigo-400/40 rounded-xl p-3 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xl">🔔</span>
              <div className="flex-1">
                <p className="text-xs font-bold text-indigo-300">明日も忘れないように</p>
                <p className="text-[11px] text-gray-300 mt-0.5">
                  朝8時に通知を届けましょう。ガイコツ先生があなたをお待ちします。
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={enableNotif}
                disabled={enablingNotif}
                className="flex-1 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 rounded-lg text-xs font-bold text-white active:scale-[0.98] transition"
              >
                {enablingNotif ? "設定中..." : "✨ 朝8時に通知"}
              </button>
              <button
                onClick={dismissNudge}
                className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs text-gray-400"
              >
                あとで
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ========= 今日まだチェックインしていない =========
  return (
    <div className="relative overflow-hidden rounded-2xl p-4 border border-amber-500/40 bg-gradient-to-br from-amber-500/15 via-orange-600/10 to-yellow-500/15">
      <div className="flex items-start gap-3 mb-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-skeleton-sensei-face.png"
          alt="ガイコツ先生"
          className="w-11 h-11 object-contain flex-shrink-0"
        />
        <div className="flex-1">
          <p className="text-xs text-amber-400 font-bold tracking-wide mb-0.5">
            ☀️ 今日のコンディションチェック
          </p>
          <p className="text-sm text-white leading-tight font-semibold">{greeting}</p>
          <p className="text-[11px] text-gray-300 mt-1">
            今日の体調はどうですか？1タップでOK
          </p>
        </div>
      </div>

      {/* 5段階ボタン */}
      <div className="grid grid-cols-5 gap-1.5 mb-2">
        {moodOptions.map((m) => (
          <button
            key={m.level}
            onClick={() => setSelectedMood(m.level)}
            disabled={submitting}
            className={`py-2.5 rounded-xl border-2 flex flex-col items-center gap-0.5 transition active:scale-95 ${
              selectedMood === m.level
                ? `bg-gradient-to-br ${m.color} shadow-lg`
                : "bg-gray-900/40 border-gray-700"
            }`}
          >
            <span className="text-xl">{m.emoji}</span>
            <span className="text-[10px] text-gray-300 font-bold leading-none">{m.label}</span>
          </button>
        ))}
      </div>

      {/* 一言メモ（オプション） */}
      {!showNoteInput && selectedMood && (
        <button
          onClick={() => setShowNoteInput(true)}
          className="w-full text-[11px] text-gray-400 py-1.5 underline"
        >
          + 体の部位など一言を追加（任意）
        </button>
      )}
      {showNoteInput && (
        <input
          type="text"
          value={bodyNote}
          onChange={(e) => setBodyNote(e.target.value)}
          placeholder="例: 朝から首が痛い / 肩が凝っている"
          maxLength={60}
          className="w-full bg-gray-900/50 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white mb-2 placeholder-gray-600"
        />
      )}

      {/* 送信ボタン */}
      {selectedMood && (
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:opacity-50 rounded-xl text-sm font-bold text-white shadow-lg active:scale-[0.98] transition"
        >
          {submitting ? "ガイコツ先生が見立て中..." : "✨ ガイコツ先生に見てもらう"}
        </button>
      )}
    </div>
  );
}

// ==================== 🎯 今日のコーチング課題カード ====================
function CoachingTodayCard({
  onNavigate,
  onSelectSymptom,
}: {
  onNavigate: (s: Screen) => void;
  onSelectSymptom: (id: SelectableSymptomId) => void;
}) {
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/coaching?deviceId=${encodeURIComponent(deviceId || "")}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const completeTask = async () => {
    if (!data?.todayTask || data.todayTask.completed) return;
    setCompleting(true);
    try {
      await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          deviceId: getDeviceId(),
          taskId: data.todayTask.id,
        }),
      });
      await load();
    } catch {
      /* ignore */
    } finally {
      setCompleting(false);
    }
  };

  if (loading) return null;
  if (!data?.hasProgram || !data.todayTask || !data.progress) return null;

  const t = data.todayTask;
  const cat = CATEGORY_BADGE[t.category];

  return (
    <button
      onClick={() => onNavigate("coaching")}
      className={`w-full text-left rounded-2xl p-4 border-2 transition active:scale-[0.99] relative overflow-hidden ${
        t.completed
          ? "bg-gradient-to-br from-emerald-500/15 to-teal-500/10 border-emerald-500/40"
          : "bg-gradient-to-br from-emerald-500/15 to-cyan-500/10 border-emerald-500/40"
      }`}
    >
      {/* バッジ: Day X */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-bold text-emerald-400 tracking-wider">
          🎯 30日コーチング ・ Day {t.dayNumber} / {data.progress.totalDays}
        </span>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cat.color}`}
        >
          {cat.emoji} {cat.label}
        </span>
      </div>

      {/* 進捗バー */}
      <div className="h-1.5 bg-gray-800/50 rounded-full overflow-hidden mb-3">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400"
          style={{ width: `${data.progress.progressPercent}%` }}
        />
      </div>

      {/* タスク内容 */}
      <div className="flex items-start gap-3">
        <span className="text-3xl">{t.completed ? "✅" : cat.emoji}</span>
        <div className="flex-1">
          <p className={`text-sm font-bold leading-tight ${
            t.completed ? "text-emerald-300" : "text-white"
          }`}>
            {t.title}
          </p>
          <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">
            {t.description}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            ⏱ 約 {t.estimatedMinutes} 分
          </p>
        </div>
      </div>

      {/* 完了ボタン or 完了済み表示 */}
      {!t.completed && (
        <div className="flex gap-2 mt-3">
          {t.symptomId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelectSymptom(t.symptomId as SelectableSymptomId);
              }}
              className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-300"
            >
              🎬 動画を見る
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              completeTask();
            }}
            disabled={completing}
            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-xs font-bold text-white"
          >
            {completing ? "..." : "✅ 完了"}
          </button>
        </div>
      )}
      {t.completed && (
        <p className="text-center text-emerald-400 text-xs font-bold mt-2">
          🎉 今日の課題、完了しました！
        </p>
      )}
    </button>
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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      // クライアントのローカルタイムゾーンで「その日の0:00〜翌日0:00」を計算
      const startLocal = new Date(selectedDate);
      startLocal.setHours(0, 0, 0, 0);
      const endLocal = new Date(startLocal);
      endLocal.setDate(endLocal.getDate() + 1);
      // iOS Safari のキャッシュ回避のためタイムスタンプを付与
      const res = await fetch(
        `/api/meal/today?deviceId=${encodeURIComponent(deviceId || "")}&start=${encodeURIComponent(
          startLocal.toISOString()
        )}&end=${encodeURIComponent(endLocal.toISOString())}&t=${Date.now()}`,
        {
          cache: "no-store",
          headers: {
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
          },
        }
      );
      const json = await res.json();
      if (res.ok) setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchData();

    // 画面に戻ってきたとき自動リフレッシュ（食事記録後にホームに戻った時など）
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", fetchData);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", fetchData);
    };
  }, [fetchData]);

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
      {/* 週間カレンダー + 更新ボタン */}
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-between gap-1 flex-1">
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
        {/* 🔄 更新ボタン（食事記録後に手動で最新化） */}
        <button
          onClick={fetchData}
          disabled={loading}
          aria-label="更新"
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-gray-800 border border-gray-700 text-emerald-400 active:scale-90 disabled:opacity-50 transition"
        >
          <span className={`text-base ${loading ? "animate-spin" : ""}`}>🔄</span>
        </button>
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

function MealScreen({
  onNavigate,
  initialMode,
  onModeConsumed,
  onConsultMeal,
}: {
  onNavigate: (s: Screen) => void;
  initialMode?: "home" | "goal" | "calendar" | null;
  onModeConsumed?: () => void;
  onConsultMeal?: () => void;
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

          {/* ガイコツ先生にこの食事を相談 */}
          {onConsultMeal && (
            <button
              onClick={onConsultMeal}
              className="btn-secondary w-full px-4 py-4 flex items-center justify-center gap-3"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                className="w-10 h-10 object-contain"
              />
              <span className="text-base font-bold">ガイコツ先生にこの食事を相談する</span>
            </button>
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

        </div>
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

// ==================== 週次・月次レポート画面 ====================
type ReportStats = {
  period: "week" | "month";
  periodLabel: string;
  postureCount: number;
  postureImprovement: string;
  mealCount: number;
  avgCalories: number;
  avgProtein: number;
  avgMealScore: number;
  weightChange: number;
  topSymptoms: Array<{ label: string; count: number }>;
  goal: {
    goal_type: string;
    target_calories: number;
    target_protein_g: number;
  } | null;
};

type ReportData = {
  period: "week" | "month";
  hasData: boolean;
  message?: string;
  stats?: ReportStats;
  report?: {
    title: string;
    summary: string;
    praise: string;
    advice: string;
    nextGoal: string;
  } | null;
  generatedAt?: string;
};

function ReportScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: "week" | "month") => {
    setLoading(true);
    setError(null);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/report?deviceId=${encodeURIComponent(deviceId || "")}&period=${p}`,
        { cache: "no-store" }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "レポート取得失敗");
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(period);
  }, [period, load]);

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">📊 ガイコツ先生のレポート</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* 期間切り替え */}
        <div className="flex gap-2">
          <button
            onClick={() => setPeriod("week")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              period === "week"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 border border-gray-700"
            }`}
          >
            📅 週次レポート
          </button>
          <button
            onClick={() => setPeriod("month")}
            className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition ${
              period === "month"
                ? "bg-emerald-600 text-white"
                : "bg-gray-800 text-gray-400 border border-gray-700"
            }`}
          >
            🗓️ 月次レポート
          </button>
        </div>

        {loading && (
          <div className="card-base p-10 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                className="w-12 h-12 object-contain animate-pulse"
              />
            </div>
            <p className="text-sm text-gray-300 animate-pulse">
              ガイコツ先生がレポートを作成中...
            </p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-sm text-red-300">
            ⚠️ {error}
          </div>
        )}

        {!loading && data && !data.hasData && (
          <div className="card-base p-6 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icon-skeleton-sensei-face.png"
              alt="ガイコツ先生"
              className="w-16 h-16 object-contain mx-auto mb-3"
            />
            <p className="text-sm text-gray-300 leading-relaxed">
              {data.message || "まだ記録が不足しています"}
            </p>
            <button
              onClick={() => onNavigate("home")}
              className="btn-primary mt-4 px-6 py-2.5 text-sm"
            >
              記録を始める
            </button>
          </div>
        )}

        {!loading && data && data.hasData && data.stats && (
          <>
            {/* AIレポート（ガイコツ先生の総評） */}
            {data.report && (
              <div className="card-accent-indigo p-5 space-y-3">
                <div className="flex items-start gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icon-skeleton-sensei-face.png"
                    alt="ガイコツ先生"
                    className="w-14 h-14 object-contain flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-indigo-300 font-bold tracking-wide">
                      ガイコツ先生の振り返り
                    </p>
                    <h3 className="text-lg font-extrabold text-white mt-1 leading-tight">
                      {data.report.title}
                    </h3>
                    <p className="text-sm text-indigo-100 mt-1 leading-relaxed">
                      {data.report.summary}
                    </p>
                  </div>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[11px] text-emerald-300 font-bold mb-1">
                    💪 素晴らしかった点
                  </p>
                  <p className="text-sm text-gray-100 leading-relaxed">
                    {data.report.praise}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[11px] text-amber-300 font-bold mb-1">
                    🎯 改善のヒント
                  </p>
                  <p className="text-sm text-gray-100 leading-relaxed">
                    {data.report.advice}
                  </p>
                </div>

                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <p className="text-[11px] text-pink-300 font-bold mb-1">
                    🚀 次の目標
                  </p>
                  <p className="text-sm text-gray-100 leading-relaxed">
                    {data.report.nextGoal}
                  </p>
                </div>
              </div>
            )}

            {/* 統計サマリー */}
            <div className="card-base p-4 space-y-3">
              <p className="text-[11px] text-gray-400 font-bold tracking-wide">
                📊 {data.stats.periodLabel}の統計
              </p>

              <div className="grid grid-cols-2 gap-2">
                <StatBlock
                  label="姿勢チェック"
                  value={`${data.stats.postureCount}`}
                  unit="回"
                  hint={data.stats.postureImprovement}
                />
                <StatBlock
                  label="食事記録"
                  value={`${data.stats.mealCount}`}
                  unit="件"
                />
                <StatBlock
                  label="平均カロリー"
                  value={`${data.stats.avgCalories}`}
                  unit="kcal/日"
                />
                <StatBlock
                  label="平均タンパク質"
                  value={`${data.stats.avgProtein}`}
                  unit="g/日"
                />
                <StatBlock
                  label="食事スコア"
                  value={`${data.stats.avgMealScore}`}
                  unit="/100"
                />
                <StatBlock
                  label="体重変化"
                  value={`${data.stats.weightChange > 0 ? "+" : ""}${data.stats.weightChange}`}
                  unit="kg"
                />
              </div>

              {data.stats.topSymptoms.length > 0 && (
                <div className="pt-2 border-t border-white/5">
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    気になっているお悩み TOP3
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {data.stats.topSymptoms.map((s) => (
                      <span
                        key={s.label}
                        className="text-[11px] bg-gray-800 rounded-full px-3 py-1 border border-gray-700"
                      >
                        {s.label} ({s.count}回)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function StatBlock({
  label,
  value,
  unit,
  hint,
}: {
  label: string;
  value: string;
  unit: string;
  hint?: string;
}) {
  return (
    <div className="bg-gray-900/50 rounded-xl px-3 py-2 border border-white/5">
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className="text-lg font-extrabold text-white mt-0.5">
        {value}
        <span className="text-[11px] font-normal text-gray-400 ml-1">
          {unit}
        </span>
      </p>
      {hint && <p className="text-[10px] text-emerald-400 mt-0.5">{hint}</p>}
    </div>
  );
}

// ==================== 友達招待画面 ====================
type InviteData = {
  code: string;
  useCount: number;
  totalInvited: number;
  bonusFreeMonths: number;
  createdAt: string;
  shareUrl: string;
};

// ==================== 📸 Before/After 比較画面 ====================
interface BeforeAfterRecord {
  id: string;
  imageUrl: string;
  createdAt: string;
  score: number;
  issueCount: number;
  diagnosis?: Array<{ level: string; label: string; message?: string }>;
}

interface BeforeAfterData {
  hasData: boolean;
  reason?: string;
  userName?: string | null;
  first?: BeforeAfterRecord;
  latest?: BeforeAfterRecord;
  firstRecord?: BeforeAfterRecord;
  summary?: {
    daysBetween: number;
    totalRecords: number;
    scoreDelta: number;
    issueDelta: number;
  };
  timeline?: BeforeAfterRecord[];
}

function BeforeAfterScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [data, setData] = useState<BeforeAfterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimelineIdx, setSelectedTimelineIdx] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const deviceId = getDeviceId();
        const res = await fetch(
          `/api/before-after?deviceId=${encodeURIComponent(deviceId || "")}&t=${Date.now()}`,
          { cache: "no-store" }
        );
        const json = await res.json();
        setData(json);
      } catch {
        setData({ hasData: false, reason: "error" });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const shortDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const handleShare = async () => {
    if (!data?.first || !data?.latest || !data?.summary) return;
    setSharing(true);
    try {
      const delta = data.summary.scoreDelta;
      const days = data.summary.daysBetween;
      const deltaText = delta >= 0 ? `+${delta}点` : `${delta}点`;
      const shareText = `ZERO-PAINで${days}日間姿勢ケアを続けた結果、姿勢スコアが${data.first.score}点→${data.latest.score}点（${deltaText}）になりました！\n\nカイロプラクター監修の無料AI姿勢チェックアプリ、ZERO-PAINはこちら👇`;

      // Web Share API
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const nav = navigator as any;
      if (nav.share) {
        await nav.share({
          title: "ZERO-PAIN姿勢ケアの記録",
          text: shareText,
          url: "https://posture-app-steel.vercel.app",
        });
      } else {
        // フォールバック: クリップボードコピー
        await navigator.clipboard.writeText(
          `${shareText}\nhttps://posture-app-steel.vercel.app`
        );
        alert("📋 シェア用テキストをコピーしました！\nSNS等に貼り付けてください。");
      }
    } catch (e) {
      if (e instanceof Error && e.name !== "AbortError") {
        alert("シェアに失敗しました: " + e.message);
      }
    } finally {
      setSharing(false);
    }
  };

  // ローディング
  if (loading) {
    return (
      <main className="fixed inset-0 bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  // ========= データ不足の場合 =========
  if (!data?.hasData) {
    const reason = data?.reason;
    return (
      <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
        <div className="flex items-center gap-3 mb-4 w-full max-w-md">
          <button
            onClick={() => onNavigate("home")}
            className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
          >
            ← 戻る
          </button>
          <h1 className="text-lg font-bold">📸 Before / After</h1>
        </div>
        <div className="w-full max-w-md card-base p-6 text-center space-y-3">
          {reason === "only_one_record" && data?.firstRecord ? (
            <>
              <div className="text-5xl">📸</div>
              <p className="text-base font-bold text-emerald-300">
                Beforeの写真が保存されました！
              </p>
              <p className="text-xs text-gray-400 leading-relaxed">
                初回の姿勢チェック（{formatDate(data.firstRecord.createdAt)}）が<br />
                Beforeとして記録されています。
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={data.firstRecord.imageUrl}
                alt="Before"
                className="w-full aspect-[3/4] object-cover rounded-xl border-2 border-emerald-500/40"
              />
              <p className="text-xs text-amber-300 mt-3">
                💡 もう1回以上、姿勢チェックをすると<br />
                Before / After の比較が見られるようになります。
              </p>
              <button
                onClick={() => onNavigate("check")}
                className="btn-primary w-full py-3"
              >
                📷 今すぐ姿勢チェックする
              </button>
            </>
          ) : (
            <>
              <div className="text-5xl">📏</div>
              <p className="text-base font-bold text-gray-300">
                まだ姿勢チェックの記録がありません
              </p>
              <p className="text-xs text-gray-400">
                まず初回の姿勢チェックをしましょう。<br />
                自動的にBefore写真として保存されます。
              </p>
              <button
                onClick={() => onNavigate("check")}
                className="btn-primary w-full py-3"
              >
                📷 姿勢チェックを始める
              </button>
            </>
          )}
        </div>
      </main>
    );
  }

  const first = data.first!;
  const latest = data.latest!;
  const summary = data.summary!;
  const timeline = data.timeline || [];

  // タイムラインから選択された写真（未選択時はlatest）
  const selected =
    selectedTimelineIdx !== null && timeline[selectedTimelineIdx]
      ? timeline[selectedTimelineIdx]
      : latest;

  const delta = summary.scoreDelta;
  const isImproved = delta > 0;

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">📸 Before / After</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* ヒーロー: 改善度表示 */}
        <div
          className={`relative overflow-hidden rounded-2xl p-5 border-2 ${
            isImproved
              ? "bg-gradient-to-br from-emerald-500/20 to-teal-600/20 border-emerald-500/50"
              : delta === 0
              ? "bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border-blue-500/40"
              : "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-amber-500/40"
          }`}
        >
          <p className="text-[11px] text-gray-300 font-bold tracking-wider mb-2">
            {summary.daysBetween}日間の変化
          </p>
          <div className="flex items-baseline gap-2">
            <span
              className={`text-4xl font-extrabold ${
                isImproved ? "text-emerald-300" : delta === 0 ? "text-blue-300" : "text-amber-300"
              }`}
            >
              {delta > 0 && "+"}
              {delta}点
            </span>
            <span className="text-sm text-gray-300">
              姿勢スコア {first.score}→{latest.score}
            </span>
          </div>
          {summary.issueDelta > 0 && (
            <p className="text-sm text-emerald-300 mt-2 font-semibold">
              ✨ 気になる点が{summary.issueDelta}個減りました！
            </p>
          )}
          {isImproved && (
            <p className="text-xs text-gray-200 mt-2 leading-relaxed">
              ZERO-PAINを{summary.totalRecords}回続けて、体の軸が整ってきています。
              この調子で継続していきましょう 🦴
            </p>
          )}
          {!isImproved && delta < 0 && (
            <p className="text-xs text-gray-200 mt-2 leading-relaxed">
              少し崩れた時期があったようですね。焦らず、できる範囲で続けていきましょう。
            </p>
          )}
        </div>

        {/* Before / After 横並び */}
        <div className="grid grid-cols-2 gap-3">
          {/* Before */}
          <div className="card-base p-2 space-y-1.5">
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider text-center">
              Before
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={first.imageUrl}
              alt="Before"
              className="w-full aspect-[3/4] object-cover rounded-lg"
            />
            <div className="text-center">
              <p className="text-[11px] text-gray-400">{shortDate(first.createdAt)}</p>
              <p className="text-lg font-extrabold text-white">{first.score}点</p>
            </div>
          </div>
          {/* After */}
          <div className="card-base p-2 space-y-1.5 border-2 border-emerald-500/40">
            <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider text-center">
              {selected === latest ? "After（最新）" : "比較"}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={selected.imageUrl}
              alt="After"
              className="w-full aspect-[3/4] object-cover rounded-lg"
            />
            <div className="text-center">
              <p className="text-[11px] text-gray-400">{shortDate(selected.createdAt)}</p>
              <p className="text-lg font-extrabold text-emerald-300">{selected.score}点</p>
            </div>
          </div>
        </div>

        {/* タイムライン */}
        {timeline.length > 2 && (
          <div className="card-base p-3 space-y-2">
            <p className="text-xs text-gray-400 font-bold">📅 タイムライン（タップで比較）</p>
            <div className="grid grid-cols-4 gap-1.5">
              {timeline.map((t, i) => {
                const isLatest = i === timeline.length - 1;
                const isSelected = selectedTimelineIdx === i || (selectedTimelineIdx === null && isLatest);
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTimelineIdx(i)}
                    className={`relative aspect-[3/4] overflow-hidden rounded-lg border-2 transition ${
                      isSelected ? "border-emerald-400" : "border-gray-700"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={t.imageUrl}
                      alt={`day ${i}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent p-1">
                      <p className="text-[9px] text-white font-bold text-center leading-none">
                        {shortDate(t.createdAt)}
                      </p>
                      <p className="text-[10px] text-emerald-300 font-extrabold text-center leading-none mt-0.5">
                        {t.score}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* シェアボタン */}
        <button
          onClick={handleShare}
          disabled={sharing}
          className="w-full py-3.5 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:brightness-110 disabled:opacity-50 rounded-2xl text-sm font-bold text-white shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition"
        >
          <span className="text-xl">📤</span>
          <span>{sharing ? "シェア中..." : "この変化をシェアする"}</span>
        </button>

        {/* 詳細: 最新の気になる点 */}
        {latest.diagnosis && latest.diagnosis.length > 0 && (
          <div className="card-base p-4 space-y-2">
            <p className="text-xs font-bold text-gray-300">📋 最新チェックの気になる点</p>
            {latest.diagnosis.map((d, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 text-xs ${
                  d.level === "good" ? "text-emerald-400" : "text-amber-300"
                }`}
              >
                <span>{d.level === "good" ? "✓" : "!"}</span>
                <div>
                  <p className="font-semibold">{d.label}</p>
                  {d.message && <p className="text-gray-400 mt-0.5">{d.message}</p>}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => onNavigate("check")}
            className="btn-primary flex-1 py-3"
          >
            📷 今すぐ再チェック
          </button>
          <button
            onClick={() => onNavigate("history")}
            className="btn-neutral flex-1 py-3"
          >
            📚 履歴を見る
          </button>
        </div>
      </div>
    </main>
  );
}

// ==================== 💀 ガイコツ先生のプロフィール画面 ====================
// ==================== 👨‍👩‍👧 家族プラン画面 ====================
interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  age: number | null;
  role: "owner" | "member";
  shareData: boolean;
  joinedAt: string;
  isMe: boolean;
}

interface FamilyData {
  hasFamily: boolean;
  reason?: string;
  family?: {
    id: string;
    name: string | null;
    inviteCode: string;
    maxMembers: number;
    isOwner: boolean;
    ownerUserId: string;
    createdAt: string;
  };
  members?: FamilyMember[];
  myMembership?: {
    role: "owner" | "member";
    shareData: boolean;
  };
  ownerSubscription?: {
    status: string;
    plan: string | null;
    current_period_end: string | null;
    trial_ends_at: string | null;
  } | null;
}

function FamilyScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [data, setData] = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [copied, setCopied] = useState<"code" | "url" | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/family?deviceId=${encodeURIComponent(deviceId || "")}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setData(json);
    } catch {
      setData({ hasFamily: false, reason: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createFamily = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          deviceId: getDeviceId(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = json.detail ? `\n\n【詳細】${json.detail}` : "";
        const hint =
          json.error === "family_create_failed"
            ? "\n\n💡 ヒント: Supabaseの Table Editor で families と family_members テーブルの「Enable Row Level Security」を外してください。"
            : "";
        throw new Error((json.message || json.error || "作成失敗") + detail + hint);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "作成失敗");
    } finally {
      setCreating(false);
    }
  };

  const joinFamily = async () => {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          deviceId: getDeviceId(),
          code: joinCode.trim().toUpperCase(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "参加失敗");
      alert(json.message || "参加しました！");
      setJoinCode("");
      setShowJoinInput(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "参加失敗");
    } finally {
      setJoining(false);
    }
  };

  const leaveFamily = async () => {
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "leave",
          deviceId: getDeviceId(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "脱退失敗");
      alert(json.message || "脱退しました");
      setShowLeaveConfirm(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "脱退失敗");
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("このメンバーを家族から削除しますか？")) return;
    setRemoving(memberId);
    try {
      const res = await fetch("/api/family", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "remove",
          deviceId: getDeviceId(),
          memberId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || json.error || "削除失敗");
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除失敗");
    } finally {
      setRemoving(null);
    }
  };

  const copy = async (text: string, kind: "code" | "url") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      alert("コピーに失敗しました");
    }
  };

  const shareInvite = async () => {
    if (!data?.family) return;
    const code = data.family.inviteCode;
    const text = `ZERO-PAINの家族プランに招待します！\n招待コード: ${code}\n\n下記URLを開いて、設定 → 家族プラン → 「コードで参加」から入力してください。\nhttps://posture-app-steel.vercel.app`;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({
          title: "ZERO-PAIN 家族プラン招待",
          text,
        });
      } catch {
        /* ignore cancel */
      }
    } else {
      copy(text, "url");
    }
  };

  if (loading) {
    return (
      <main className="fixed inset-0 bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">👨‍👩‍👧 家族プラン</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* 家族未所属の場合: 作成 or 参加 */}
        {!data?.hasFamily && (
          <>
            <div className="card-accent-emerald p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-4xl">👨‍👩‍👧</span>
                <div>
                  <p className="text-sm font-bold text-emerald-300 tracking-wider">
                    FAMILY PLAN
                  </p>
                  <h2 className="text-xl font-extrabold text-white mt-1">
                    家族みんなで健康管理
                  </h2>
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                1契約で<span className="font-bold text-emerald-300">最大4人まで</span>家族メンバーを追加できます。
                AI機能・無制限利用がみんなに広がります。
              </p>
              <ul className="space-y-1.5 text-xs text-gray-300">
                <li>✓ オーナーの有料プランがメンバー全員に適用</li>
                <li>✓ お互いの体調を共有・応援できる（任意）</li>
                <li>✓ 家族でガイコツ先生にアドバイスもらえる</li>
              </ul>
            </div>

            {/* 家族を作成 */}
            <button
              onClick={createFamily}
              disabled={creating}
              className="btn-primary w-full py-4 flex items-center justify-center gap-3"
            >
              <span className="text-2xl">✨</span>
              <div className="text-left">
                <p className="text-base font-extrabold">{creating ? "作成中..." : "家族グループを作成"}</p>
                <p className="text-xs opacity-90">あなたがオーナーになります</p>
              </div>
            </button>

            {/* 招待コードで参加 */}
            <button
              onClick={() => setShowJoinInput(!showJoinInput)}
              className="btn-neutral w-full py-3.5 flex items-center justify-center gap-2"
            >
              <span className="text-xl">🔑</span>
              <span className="font-bold">招待コードで参加する</span>
            </button>

            {showJoinInput && (
              <div className="card-base p-4 space-y-3">
                <p className="text-xs text-gray-400">
                  家族のオーナーから受け取った8桁の招待コードを入力
                </p>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="例: ABCD1234"
                  maxLength={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-center font-mono text-lg tracking-widest text-white"
                />
                <button
                  onClick={joinFamily}
                  disabled={joining || joinCode.trim().length !== 8}
                  className="btn-primary w-full py-2.5 disabled:opacity-50"
                >
                  {joining ? "参加中..." : "参加する"}
                </button>
              </div>
            )}
          </>
        )}

        {/* 家族所属中の場合 */}
        {data?.hasFamily && data.family && (
          <>
            {/* 家族情報ヘッダー */}
            <div className="card-accent-emerald p-5 text-center space-y-2">
              <div className="text-4xl">👨‍👩‍👧</div>
              <h2 className="text-xl font-extrabold text-gray-900">
                {data.family.name || "家族グループ"}
              </h2>
              <p className="text-base font-bold text-gray-900">
                {data.members?.length || 0} / {data.family.maxMembers} 人
                {data.family.isOwner && (
                  <span className="ml-2 inline-block px-2 py-0.5 bg-emerald-600 text-white text-sm font-bold rounded-full">
                    👑 あなたがオーナー
                  </span>
                )}
              </p>
            </div>

            {/* オーナーのみ: 招待コード表示 */}
            {data.family.isOwner && (
              <div className="card-base p-4 space-y-3">
                <p className="text-xs text-gray-400 font-bold">🔑 招待コード</p>
                <button
                  onClick={() => copy(data.family!.inviteCode, "code")}
                  className="w-full bg-gray-800 border-2 border-emerald-500/40 hover:border-emerald-500 rounded-2xl p-4 transition active:scale-[0.98]"
                >
                  <p className="text-3xl font-bold tracking-[0.3em] text-emerald-300 font-mono">
                    {data.family.inviteCode}
                  </p>
                  <p className="text-xs text-gray-400 mt-2">
                    {copied === "code" ? "✅ コピーしました!" : "タップしてコピー"}
                  </p>
                </button>
                <button
                  onClick={shareInvite}
                  className="btn-secondary w-full py-3 flex items-center justify-center gap-2"
                >
                  <span className="text-xl">📤</span>
                  <span className="font-bold">家族にシェアする</span>
                </button>
              </div>
            )}

            {/* メンバー一覧 */}
            <div className="card-base p-4 space-y-3">
              <p className="text-xs text-gray-400 font-bold">👥 メンバー</p>
              <div className="space-y-2">
                {data.members?.map((m) => (
                  <div
                    key={m.id}
                    className="bg-gray-800 border border-gray-700 rounded-xl p-3 flex items-center gap-3"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold">
                      {m.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">
                        {m.name}
                        {m.isMe && <span className="text-xs text-emerald-400 ml-1">（あなた）</span>}
                      </p>
                      <p className="text-[11px] text-gray-400">
                        {m.role === "owner" ? "👑 オーナー" : "👤 メンバー"}
                        {m.age && ` ・ ${m.age}歳`}
                      </p>
                    </div>
                    {/* オーナーが他メンバーを削除 */}
                    {data.family!.isOwner && !m.isMe && m.role !== "owner" && (
                      <button
                        onClick={() => removeMember(m.id)}
                        disabled={removing === m.id}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                      >
                        {removing === m.id ? "..." : "削除"}
                      </button>
                    )}
                  </div>
                ))}
                {/* 空きスロット表示 */}
                {data.family.isOwner &&
                  Array.from({
                    length: data.family.maxMembers - (data.members?.length || 0),
                  }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="bg-gray-900/30 border-2 border-dashed border-gray-700 rounded-xl p-3 text-center"
                    >
                      <p className="text-xs text-gray-500">空きスロット（招待コードで参加可能）</p>
                    </div>
                  ))}
              </div>
            </div>

            {/* オーナーのサブスク状態 */}
            {data.ownerSubscription && (
              <div
                className={`card-base p-4 flex items-center gap-3 ${
                  ["trial", "active_monthly", "active_yearly", "cancelled"].includes(
                    data.ownerSubscription.status
                  )
                    ? "border-2 border-emerald-500/30"
                    : ""
                }`}
              >
                <span className="text-3xl">
                  {["trial", "active_monthly", "active_yearly"].includes(
                    data.ownerSubscription.status
                  )
                    ? "✨"
                    : "🆓"}
                </span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">
                    {data.ownerSubscription.status === "active_yearly"
                      ? "年額プラン（オーナー）"
                      : data.ownerSubscription.status === "active_monthly"
                      ? "月額プラン（オーナー）"
                      : data.ownerSubscription.status === "trial"
                      ? "無料体験中（オーナー）"
                      : "無料プラン（オーナー）"}
                  </p>
                  <p className="text-[11px] text-gray-400">
                    {["trial", "active_monthly", "active_yearly"].includes(
                      data.ownerSubscription.status
                    )
                      ? "✓ 家族全員がプレミアム機能を使えます"
                      : "オーナーがプレミアムにすると家族全員が無制限利用できます"}
                  </p>
                </div>
              </div>
            )}

            {/* 脱退ボタン */}
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full py-2.5 text-sm text-red-400 hover:text-red-300"
            >
              {data.family.isOwner ? "🚪 家族グループを解散する" : "🚪 家族から脱退する"}
            </button>

            {/* 脱退確認モーダル */}
            {showLeaveConfirm && (
              <div
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
                onClick={() => setShowLeaveConfirm(false)}
              >
                <div
                  className="w-full max-w-sm bg-gray-900 border border-red-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-extrabold text-red-400">
                    {data.family.isOwner ? "🚪 家族グループを解散しますか？" : "🚪 家族から脱退しますか？"}
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    {data.family.isOwner
                      ? "全メンバーが家族から削除され、家族グループが完全に削除されます。この操作は取り消せません。"
                      : "あなたが家族から外れ、プレミアム機能が使えなくなります（自分でサブスク契約していない場合）。"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="btn-neutral flex-1 py-2.5"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={leaveFamily}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold text-white"
                    >
                      {data.family.isOwner ? "解散する" : "脱退する"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}

// ==================== 🎯 30日コーチングプログラム画面 ====================
type CoachingCategory = "stretch" | "meal" | "mindset" | "check" | "reading";

interface CoachingTaskUI {
  id: string;
  dayNumber: number;
  scheduledDate: string;
  category: CoachingCategory;
  title: string;
  description: string;
  symptomId: string | null;
  estimatedMinutes: number;
  completed: boolean;
  completedAt?: string;
}

interface CoachingProgramUI {
  id: string;
  status: string;
  goalType: string;
  goalText: string;
  summary: string;
  advice: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

interface CoachingData {
  hasProgram: boolean;
  reason?: string;
  program?: CoachingProgramUI;
  todayTask?: CoachingTaskUI | null;
  progress?: {
    completedCount: number;
    totalDays: number;
    progressPercent: number;
    currentDayNumber: number;
  };
  allTasks?: CoachingTaskUI[];
}

const COACHING_GOALS: Array<{
  id: string;
  emoji: string;
  label: string;
  desc: string;
}> = [
  { id: "posture", emoji: "🧍", label: "姿勢改善", desc: "猫背・反り腰の改善" },
  { id: "pain", emoji: "💊", label: "痛み軽減", desc: "首・肩・腰のお悩み" },
  { id: "weight", emoji: "⚖️", label: "体重管理", desc: "理想の体型へ" },
  { id: "fitness", emoji: "💪", label: "体力アップ", desc: "運動習慣をつける" },
  { id: "wellness", emoji: "🌿", label: "全体の健康", desc: "総合的なウェルネス" },
];

const CATEGORY_BADGE: Record<CoachingCategory, { emoji: string; label: string; color: string }> = {
  stretch: { emoji: "🧘", label: "ストレッチ", color: "text-emerald-300 bg-emerald-500/20" },
  meal: { emoji: "🍱", label: "食事", color: "text-amber-300 bg-amber-500/20" },
  mindset: { emoji: "🧠", label: "心構え", color: "text-indigo-300 bg-indigo-500/20" },
  check: { emoji: "📋", label: "チェック", color: "text-blue-300 bg-blue-500/20" },
  reading: { emoji: "📖", label: "学び", color: "text-purple-300 bg-purple-500/20" },
};

function CoachingScreen({
  onNavigate,
  onSelectSymptom,
}: {
  onNavigate: (s: Screen) => void;
  onSelectSymptom: (id: SelectableSymptomId) => void;
}) {
  const [data, setData] = useState<CoachingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [showAllTasks, setShowAllTasks] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);
  const [celebrationTask, setCelebrationTask] = useState<CoachingTaskUI | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const deviceId = getDeviceId();
      const res = await fetch(
        `/api/coaching?deviceId=${encodeURIComponent(deviceId || "")}&t=${Date.now()}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setData(json);
    } catch {
      setData({ hasProgram: false, reason: "error" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const startProgram = async () => {
    if (!selectedGoal) return;
    setStarting(true);
    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          deviceId: getDeviceId(),
          goalType: selectedGoal,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        const detail = json.detail ? `\n\n【詳細】${json.detail}` : "";
        const hint =
          json.error === "program_create_failed"
            ? "\n\n💡 ヒント: SupabaseのTable Editorで coaching_programs と coaching_tasks テーブルの「Enable Row Level Security」を外してください。"
            : "";
        throw new Error((json.message || json.error || "開始失敗") + detail + hint);
      }
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "開始失敗");
    } finally {
      setStarting(false);
    }
  };

  const completeTask = async (task: CoachingTaskUI) => {
    if (task.completed) return;
    setCompleting(task.id);
    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          deviceId: getDeviceId(),
          taskId: task.id,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "完了失敗");
      // 達成演出
      setCelebrationTask({ ...task, completed: true });
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "完了失敗");
    } finally {
      setCompleting(null);
    }
  };

  const abandonProgram = async () => {
    try {
      const res = await fetch("/api/coaching", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "abandon",
          deviceId: getDeviceId(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "中止失敗");
      setShowAbandonConfirm(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : "中止失敗");
    }
  };

  if (loading) {
    return (
      <main className="fixed inset-0 bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">読み込み中...</p>
      </main>
    );
  }

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">🎯 30日コーチング</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* プログラム未開始: ゴール選択 */}
        {!data?.hasProgram && (
          <>
            <div className="card-accent-emerald p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-4xl">🎯</span>
                <div>
                  <p className="text-sm font-bold text-emerald-300 tracking-wider">
                    30-DAY COACHING
                  </p>
                  <h2 className="text-xl font-extrabold text-white mt-1">
                    あなた専用30日プログラム
                  </h2>
                </div>
              </div>
              <p className="text-sm text-gray-300 leading-relaxed">
                ガイコツ先生が<span className="font-bold text-emerald-300">あなたの体・お悩み・目標</span>から、
                毎日の課題を組み立てます。1日5〜10分、続けるだけで体が変わる。
              </p>
              <ul className="space-y-1.5 text-xs text-gray-300">
                <li>✓ AIが個別の30タスクを自動生成</li>
                <li>✓ 1日1タスク、5〜10分で完結</li>
                <li>✓ 達成バッジで継続モチベ</li>
                <li>✓ 1ヶ月後に効果が見える</li>
              </ul>
            </div>

            {/* ゴール選択 */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-gray-400 px-1">
                🎯 STEP 1: ゴールを選んでください
              </p>
              {COACHING_GOALS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGoal(g.id)}
                  className={`w-full p-3 rounded-xl border-2 flex items-center gap-3 transition active:scale-[0.98] text-left ${
                    selectedGoal === g.id
                      ? "bg-emerald-500/20 border-emerald-500"
                      : "bg-gray-900 border-gray-700"
                  }`}
                >
                  <span className="text-3xl">{g.emoji}</span>
                  <div className="flex-1">
                    <p className={`text-sm font-bold ${selectedGoal === g.id ? "text-emerald-300" : "text-white"}`}>
                      {g.label}
                    </p>
                    <p className="text-[11px] text-gray-400">{g.desc}</p>
                  </div>
                  {selectedGoal === g.id && (
                    <span className="text-emerald-400 text-xl">✓</span>
                  )}
                </button>
              ))}
            </div>

            {/* 開始ボタン */}
            <button
              onClick={startProgram}
              disabled={!selectedGoal || starting}
              className="btn-primary w-full py-4 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {starting ? (
                <>
                  <span className="text-xl animate-spin">⚙️</span>
                  <span className="font-extrabold">AIが30日プランを生成中...</span>
                </>
              ) : (
                <>
                  <span className="text-2xl">✨</span>
                  <span className="font-extrabold">30日プログラムを始める</span>
                </>
              )}
            </button>

            {starting && (
              <p className="text-[11px] text-gray-400 text-center">
                30秒〜1分かかります。少々お待ちください。
              </p>
            )}
          </>
        )}

        {/* プログラム進行中 */}
        {data?.hasProgram && data.program && data.progress && (
          <>
            {/* プログラム概要 */}
            <div className="card-accent-emerald p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-4xl">🎯</span>
                <div>
                  <p className="text-sm font-bold text-emerald-300 tracking-wider">
                    30-DAY COACHING
                  </p>
                  <h2 className="text-base font-extrabold text-white mt-1 leading-tight">
                    {data.program.summary}
                  </h2>
                </div>
              </div>
              {/* 進捗バー */}
              <div className="bg-black/30 rounded-xl p-3 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-gray-300">継続日数</span>
                  <span className="text-sm font-bold text-white">
                    <span className="text-2xl text-emerald-300">{data.progress.completedCount}</span>
                    <span className="text-xs text-gray-400"> / {data.progress.totalDays}日</span>
                  </span>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all"
                    style={{ width: `${data.progress.progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-gray-400">
                  {data.progress.progressPercent}% 完了
                  {data.progress.currentDayNumber > 0 && ` ・ 今日は ${data.progress.currentDayNumber}日目`}
                </p>
              </div>
              {/* ガイコツ先生の励まし */}
              <div className="flex items-start gap-2 bg-black/30 rounded-xl p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-skeleton-sensei-face.png"
                  alt="ガイコツ先生"
                  className="w-10 h-10 object-contain flex-shrink-0"
                />
                <p className="text-xs text-gray-200 leading-relaxed">
                  {data.program.advice}
                </p>
              </div>
            </div>

            {/* 今日の課題 */}
            {data.todayTask && (
              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-400 px-1">
                  ☀️ 今日の課題（Day {data.todayTask.dayNumber}）
                </p>
                <div
                  className={`card-base p-4 space-y-3 border-2 ${
                    data.todayTask.completed
                      ? "border-emerald-500/40"
                      : "border-amber-500/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">
                      {data.todayTask.completed ? "✅" : CATEGORY_BADGE[data.todayTask.category].emoji}
                    </span>
                    <div className="flex-1">
                      <span
                        className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          CATEGORY_BADGE[data.todayTask.category].color
                        }`}
                      >
                        {CATEGORY_BADGE[data.todayTask.category].label}
                      </span>
                      <p className="text-base font-bold text-white mt-1.5 leading-tight">
                        {data.todayTask.title}
                      </p>
                      <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                        {data.todayTask.description}
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        ⏱ 約 {data.todayTask.estimatedMinutes} 分
                      </p>
                    </div>
                  </div>

                  {/* ストレッチタスクなら関連動画ボタン */}
                  {data.todayTask.symptomId && !data.todayTask.completed && (
                    <button
                      onClick={() => onSelectSymptom(data.todayTask!.symptomId as SelectableSymptomId)}
                      className="w-full py-2 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 rounded-lg text-xs font-bold text-emerald-300 flex items-center justify-center gap-2 transition"
                    >
                      <span>🎬</span>
                      <span>関連ストレッチ動画を見る</span>
                    </button>
                  )}

                  {/* 完了ボタン */}
                  {!data.todayTask.completed ? (
                    <button
                      onClick={() => completeTask(data.todayTask!)}
                      disabled={completing === data.todayTask.id}
                      className="btn-primary w-full py-3"
                    >
                      {completing === data.todayTask.id ? "保存中..." : "✅ 今日の課題を完了する"}
                    </button>
                  ) : (
                    <div className="text-center py-2 text-emerald-400 font-bold text-sm">
                      🎉 今日の課題、完了しました！
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 全タスク表示トグル */}
            <button
              onClick={() => setShowAllTasks(!showAllTasks)}
              className="btn-neutral w-full py-2.5 text-sm flex items-center justify-center gap-2"
            >
              <span>📅</span>
              <span>{showAllTasks ? "閉じる" : "30日全タスクを見る"}</span>
              <span>{showAllTasks ? "▲" : "▼"}</span>
            </button>

            {showAllTasks && data.allTasks && (
              <div className="space-y-1.5">
                {data.allTasks.map((t) => (
                  <div
                    key={t.id}
                    className={`p-3 rounded-xl text-left flex items-center gap-3 ${
                      t.completed
                        ? "bg-emerald-500/10 border border-emerald-500/30"
                        : "bg-gray-900 border border-gray-800"
                    }`}
                  >
                    <span className="text-2xl">
                      {t.completed ? "✅" : CATEGORY_BADGE[t.category].emoji}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400">Day {t.dayNumber}</p>
                      <p className={`text-xs font-bold truncate ${
                        t.completed ? "text-emerald-300" : "text-white"
                      }`}>
                        {t.title}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* 中止ボタン */}
            <button
              onClick={() => setShowAbandonConfirm(true)}
              className="w-full py-2.5 text-sm text-red-400 hover:text-red-300"
            >
              プログラムを中止する
            </button>

            {/* 中止確認モーダル */}
            {showAbandonConfirm && (
              <div
                className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-6"
                onClick={() => setShowAbandonConfirm(false)}
              >
                <div
                  className="w-full max-w-sm bg-gray-900 border border-red-500/40 rounded-3xl p-5 shadow-2xl space-y-4"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-extrabold text-red-400">
                    プログラムを中止しますか？
                  </h3>
                  <p className="text-sm text-gray-300 leading-relaxed">
                    現在の進捗（{data.progress.completedCount}/{data.progress.totalDays}日）は保存されますが、
                    新しいプログラムを始めるとリセットされます。
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowAbandonConfirm(false)}
                      className="btn-neutral flex-1 py-2.5"
                    >
                      キャンセル
                    </button>
                    <button
                      onClick={abandonProgram}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 rounded-xl text-sm font-bold text-white"
                    >
                      中止する
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* タスク達成お祝いモーダル */}
      {celebrationTask && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6"
          onClick={() => setCelebrationTask(null)}
        >
          <div
            className="w-full max-w-sm bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-600 rounded-3xl p-6 shadow-2xl space-y-4 text-center animate-slide-up-fade"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-extrabold text-white">
              Day {celebrationTask.dayNumber} 達成！
            </h2>
            <p className="text-sm text-emerald-100 leading-relaxed">
              「{celebrationTask.title}」を完了しました。
              この一歩が、未来の体を変えていきます ✨
            </p>
            <button
              onClick={() => setCelebrationTask(null)}
              className="w-full py-3 bg-white text-emerald-700 rounded-xl font-extrabold active:scale-[0.98] transition"
            >
              続ける
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function SenseiProfileScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  return (
    <main className="fixed inset-0 bg-gradient-to-b from-gray-950 via-indigo-950/30 to-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button
          onClick={() => onNavigate("home")}
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
        >
          ← 戻る
        </button>
        <h1 className="text-lg font-bold">💀 ガイコツ先生について</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {/* プロフィールヘッダー */}
        <div className="card-base p-6 text-center space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-skeleton-sensei-face.png"
            alt="ガイコツ先生"
            className="w-28 h-28 mx-auto object-contain drop-shadow-[0_0_30px_rgba(99,102,241,0.5)]"
          />
          <div>
            <p className="text-xs text-indigo-400 font-bold tracking-widest">AI CHIROPRACTOR</p>
            <h2 className="text-2xl font-extrabold text-white mt-1">ガイコツ先生</h2>
            <p className="text-xs text-gray-400 mt-1">本名: 骨田 健太郎（ほねだ けんたろう）</p>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed italic">
            「骨の髄まで、あなたの体を見つめます。<br />
            体の軸が整えば、人生の軸も整う」
          </p>
        </div>

        {/* ストーリー */}
        <div className="card-base p-5 space-y-3">
          <p className="text-xs font-bold text-amber-300 tracking-widest">STORY</p>
          <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
            <p>
              生前、先生は30年にわたって整体院を営み、<span className="text-emerald-300 font-bold">1万人以上の体</span>を整えてきました。
            </p>
            <p>
              「人は見た目ではなく、骨格で決まる」と信じ、骨と向き合い続けた人生。その熱意は、骨だけになった今も変わることはありません。
            </p>
            <p>
              ZERO-PAINアプリに宿り、現代のスマホユーザーが抱える姿勢の悩み、慢性的な痛み、運動不足、食事の乱れ──すべてを<span className="text-emerald-300 font-bold">AIの力で見立て</span>、一人ひとりに寄り添うようになりました。
            </p>
            <p>
              ガイコツの姿に恐れる人もいるかもしれません。でも安心してください。見た目は骨でも、中身は<span className="text-emerald-300 font-bold">永遠の35歳</span>、情熱と愛情にあふれるカイロプラクターです。
            </p>
          </div>
        </div>

        {/* 得意分野 */}
        <div className="card-base p-5 space-y-3">
          <p className="text-xs font-bold text-amber-300 tracking-widest">EXPERTISE / 得意分野</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { emoji: "🦴", label: "姿勢分析" },
              { emoji: "💪", label: "筋肉・骨格" },
              { emoji: "🥗", label: "食事×体の関係" },
              { emoji: "😌", label: "ストレスケア" },
              { emoji: "🌙", label: "睡眠・疲労" },
              { emoji: "🧘", label: "ストレッチ指導" },
            ].map((x, i) => (
              <div
                key={i}
                className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-2"
              >
                <span className="text-lg">{x.emoji}</span>
                <span className="text-gray-200 font-semibold">{x.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 口癖 */}
        <div className="card-base p-5 space-y-3">
          <p className="text-xs font-bold text-amber-300 tracking-widest">CATCHPHRASE / 口癖</p>
          <div className="space-y-2">
            {[
              "骨の髄まで分析しましょう",
              "体の軸が整えば、人生の軸も整う",
              "今日も一緒にコツコツやりましょう",
              "あなたのこと、ちゃんと見てますよ",
            ].map((phrase, i) => (
              <div
                key={i}
                className="bg-gradient-to-r from-indigo-900/40 to-purple-900/30 border-l-4 border-indigo-400 rounded-r-lg px-3 py-2"
              >
                <p className="text-sm text-gray-200 italic">「{phrase}」</p>
              </div>
            ))}
          </div>
        </div>

        {/* 関係性レベル */}
        <div className="card-base p-5 space-y-3">
          <p className="text-xs font-bold text-amber-300 tracking-widest">RELATIONSHIP / 関係性の成長</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            使い続けるほど、ガイコツ先生との関係が深まります。口調も少しずつ変化していきます。
          </p>
          <div className="space-y-2">
            {[
              { range: "1〜3日", label: "はじめまして", desc: "丁寧な敬語で距離感を保ちます" },
              { range: "4〜14日", label: "打ち解けてきた頃", desc: "親しみのある敬語になります" },
              { range: "15〜30日", label: "信頼関係", desc: "名前で呼んで相談に乗ってくれます" },
              { range: "31日〜", label: "気の置けない関係", desc: "タメ口が混ざる親しい友人に ✨" },
            ].map((r, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-20 text-[11px] text-indigo-300 font-bold pt-0.5">{r.range}</div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-white">{r.label}</p>
                  <p className="text-[11px] text-gray-400">{r.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={() => onNavigate("ai-counsel")}
          className="btn-primary w-full py-3.5 flex items-center justify-center gap-2"
        >
          <span className="text-xl">💬</span>
          <span>ガイコツ先生と話す</span>
        </button>
      </div>
    </main>
  );
}

function InviteScreen({ onNavigate }: { onNavigate: (s: Screen) => void }) {
  const [data, setData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "url" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const deviceId = getDeviceId();
        const res = await fetch(
          `/api/invite?deviceId=${encodeURIComponent(deviceId || "")}`
        );
        const d = await res.json();
        if (res.ok) {
          setData(d);
        } else {
          setErrorDetail(d.detail || d.error || "不明なエラー");
        }
      } catch (e) {
        setErrorDetail(e instanceof Error ? e.message : "通信エラー");
      }
      setLoading(false);
    })();
  }, []);

  const copyToClipboard = async (text: string, type: "code" | "url") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  const shareText = data
    ? `ZERO-PAIN（ゼロペイン）を試してみて！
AI姿勢チェックと食事分析で健康習慣をサポートしてくれるアプリです🦴✨

招待コード: ${data.code}
${data.shareUrl}

このコードで登録すると7日→14日の無料トライアルに延長されます🎁`
    : "";

  const shareToNative = async () => {
    if (!data) return;
    // Web Share API（iPhone Safari 対応）
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title: "ZERO-PAIN に招待します",
          text: shareText,
          url: data.shareUrl,
        });
      } catch { /* user cancelled */ }
    } else {
      // フォールバック: クリップボードにコピー
      copyToClipboard(shareText, "url");
    }
  };

  const shareToLine = () => {
    if (!data) return;
    const url = `https://line.me/R/msg/text/?${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
  };

  const shareToTwitter = () => {
    if (!data) return;
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
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
        <h1 className="text-lg font-bold">🎁 友達を招待</h1>
      </div>

      <div className="w-full max-w-md space-y-4">
        {loading ? (
          <div className="card-base p-8 text-center text-gray-400">
            読み込み中...
          </div>
        ) : !data ? (
          <div className="space-y-3">
            <div className="card-accent-amber p-4 space-y-2">
              <p className="text-sm font-bold text-amber-300">
                ⚠️ 招待コード機能の準備が必要です
              </p>
              <p className="text-xs text-gray-200 leading-relaxed">
                Supabase側で招待コードテーブルのセットアップが
                まだ完了していません。開発者にお問い合わせください。
              </p>
              {errorDetail && (
                <p className="text-[11px] text-gray-400 font-mono bg-gray-900/50 rounded p-2 mt-2">
                  詳細: {errorDetail}
                </p>
              )}
            </div>
            <button
              onClick={() => onNavigate("home")}
              className="btn-neutral w-full py-3 text-sm"
            >
              ホームに戻る
            </button>
          </div>
        ) : (
          <>
            {/* お得感の訴求 */}
            <div className="card-accent-amber p-5 space-y-3">
              <p className="text-base font-extrabold text-amber-300">
                🎁 友達招待で両方にお得特典！
              </p>
              <div className="space-y-2">
                <div className="bg-white/5 rounded-xl p-3 border border-amber-500/20">
                  <p className="text-[11px] text-amber-300 font-bold">
                    あなたへの特典
                  </p>
                  <p className="text-sm text-white mt-0.5">
                    🆓 <strong>1ヶ月分 無料</strong>（1招待成立ごと）
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-3 border border-amber-500/20">
                  <p className="text-[11px] text-amber-300 font-bold">
                    友達への特典
                  </p>
                  <p className="text-sm text-white mt-0.5">
                    🎊 無料トライアルが <strong>7日→14日</strong> に延長
                  </p>
                </div>
              </div>
            </div>

            {/* 招待コード表示 */}
            <div className="card-base p-5 space-y-3">
              <p className="text-[11px] text-gray-400 font-bold tracking-wide">
                🎫 あなたの招待コード
              </p>
              <div className="bg-gradient-to-br from-amber-500/20 to-yellow-600/10 border-2 border-amber-500/40 rounded-2xl p-5 text-center">
                <p className="text-4xl font-extrabold text-amber-300 tracking-[0.3em] font-mono">
                  {data.code}
                </p>
              </div>
              <button
                onClick={() => copyToClipboard(data.code, "code")}
                className="btn-neutral w-full py-2.5 text-sm font-bold"
              >
                {copied === "code" ? "✅ コピーしました" : "📋 コードをコピー"}
              </button>
            </div>

            {/* シェアボタン */}
            <div className="space-y-2">
              <p className="text-[11px] text-gray-400 font-bold tracking-wide px-1">
                📢 友達に教える
              </p>

              {/* ネイティブ共有（iPhone）*/}
              <button
                onClick={shareToNative}
                className="btn-primary w-full py-3.5 text-base flex items-center justify-center gap-2"
              >
                <span className="text-xl">📤</span>
                <span>共有メニューを開く</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={shareToLine}
                  className="bg-[#06C755] hover:bg-[#05b04d] text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2 text-sm"
                >
                  <span className="text-lg">💬</span>
                  LINE で送る
                </button>
                <button
                  onClick={shareToTwitter}
                  className="bg-black hover:bg-gray-900 text-white border border-gray-700 rounded-xl py-3 font-bold flex items-center justify-center gap-2 text-sm"
                >
                  <span className="text-lg">𝕏</span>
                  ポストする
                </button>
              </div>

              <button
                onClick={() => copyToClipboard(shareText, "url")}
                className="btn-neutral w-full py-2.5 text-sm"
              >
                {copied === "url" ? "✅ テキストをコピーしました" : "📋 紹介文をコピー"}
              </button>
            </div>

            {/* 実績表示 */}
            <div className="card-base p-4 space-y-2">
              <p className="text-[11px] text-gray-400 font-bold tracking-wide">
                📊 あなたの招待実績
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">招待成立数</p>
                  <p className="text-3xl font-extrabold text-emerald-300 mt-1">
                    {data.totalInvited}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      人
                    </span>
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-[11px] text-gray-400">獲得無料月数</p>
                  <p className="text-3xl font-extrabold text-amber-300 mt-1">
                    {data.bonusFreeMonths}
                    <span className="text-xs font-normal text-gray-400 ml-1">
                      ヶ月
                    </span>
                  </p>
                </div>
              </div>
              {data.totalInvited === 0 && (
                <p className="text-[11px] text-gray-500 text-center pt-1">
                  まだ招待成立はありません
                </p>
              )}
            </div>

            {/* 紹介文プレビュー */}
            <div className="card-base p-4">
              <p className="text-[11px] text-gray-400 font-bold tracking-wide mb-2">
                💬 紹介メッセージのプレビュー
              </p>
              <div className="bg-gray-900/50 rounded-xl p-3 border border-white/5">
                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {shareText}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

