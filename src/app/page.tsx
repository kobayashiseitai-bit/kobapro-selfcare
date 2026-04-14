"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { addRecord, getRecords, deleteRecord, Landmark, PostureRecord } from "./lib/storage";
import { analyzeFrontPosture, analyzeSidePosture, drawDiagnosisOverlay, drawSideDiagnosisOverlay, addLandmarkFrame, clearLandmarkBuffer } from "./lib/postureAnalysis";
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

type Screen = "loading" | "register" | "home" | "ai-counsel" | "selfcare" | "check" | "history";

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
    icon: "/icon-neck.png",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "首こり解消セルフケア",
    description: "首周りの筋肉をほぐし、痛みを和らげるストレッチです。",
  },
  {
    id: "shoulder_stiff",
    label: "肩凝り",
    icon: "/icon-shoulder.png",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "肩凝り解消セルフケア",
    description: "固まった肩周りをほぐすストレッチです。",
  },
  {
    id: "back",
    label: "腰痛",
    icon: "/icon-back.png",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "腰痛改善セルフケア",
    description: "腰回りの筋肉を緩め、腰痛を予防・改善するストレッチです。",
  },
  {
    id: "eye_fatigue",
    label: "眼精疲労",
    icon: "/icon-eye.png",
    videoUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
    videoTitle: "眼精疲労解消セルフケア",
    description: "目の疲れを取り、スッキリさせるツボ押し＆エクササイズです。",
  },
];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("loading");
  const [selectedSymptomId, setSelectedSymptomId] = useState<string | null>(null);

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

  if (screen === "loading") {
    return (
      <main className="fixed inset-0 bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 text-lg animate-pulse">読み込み中...</p>
      </main>
    );
  }

  return (
    <>
      {screen === "register" && <RegisterScreen onComplete={() => setScreen("home")} />}
      {screen === "home" && <HomeScreen onNavigate={setScreen} onSelectSymptom={goToSelfcare} />}
      {screen === "ai-counsel" && <AiCounselScreen onNavigate={setScreen} onSelectSymptom={goToSelfcare} />}
      {screen === "selfcare" && <SelfcareScreen onNavigate={setScreen} initialSymptomId={selectedSymptomId} />}
      {screen === "check" && <CheckScreen onNavigate={setScreen} />}
      {screen === "history" && <HistoryScreen onNavigate={setScreen} />}
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
            <h1 className="text-3xl font-bold bg-gradient-to-b from-blue-400 to-purple-600 bg-clip-text text-transparent">
              ZERO-PAIN
            </h1>
            <p className="text-gray-400 mt-2 text-sm">セルフケアアプリへようこそ</p>
            <p className="text-gray-500 mt-1 text-xs">はじめに基本情報をご入力ください</p>
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

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="btn-3d w-full py-4 bg-gradient-to-b from-blue-400 via-blue-600 to-purple-800 rounded-2xl font-bold text-lg shadow-[0_10px_30px_rgba(79,70,229,0.5)] disabled:opacity-50"
          >
            {saving ? "登録中..." : "はじめる"}
          </button>

          <p className="text-center text-gray-600 text-xs">
            入力された情報はセルフケアの改善に活用されます
          </p>
        </form>
      </div>
    </main>
  );
}

// ==================== PWAインストールバナー ====================
function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // スタンドアロンモードで起動済みなら表示しない
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches
      || ("standalone" in window.navigator && (window.navigator as unknown as { standalone: boolean }).standalone);
    if (isStandalone) return;

    // 一度閉じたら24時間非表示
    const dismissed = localStorage.getItem("install_banner_dismissed");
    if (dismissed && Date.now() - parseInt(dismissed) < 86400000) return;

    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    localStorage.setItem("install_banner_dismissed", String(Date.now()));
    setShow(false);
  };

  return (
    <div className="w-full max-w-md bg-blue-900/80 border border-blue-500 rounded-xl p-4 mb-4">
      <div className="flex items-start gap-3">
        <span className="text-2xl">📲</span>
        <div className="flex-1">
          <p className="font-bold text-sm mb-1">アプリをホーム画面に追加</p>
          <p className="text-xs text-blue-200">
            下の共有ボタン <span className="inline-block">⬆️</span> →「ホーム画面に追加」でアプリとして使えます
          </p>
        </div>
        <button onClick={dismiss} className="text-gray-400 text-lg">✕</button>
      </div>
    </div>
  );
}

// ==================== ホーム画面 ====================
function HomeScreen({ onNavigate, onSelectSymptom }: { onNavigate: (s: Screen) => void; onSelectSymptom: (id: string) => void }) {
  const records = getRecords(SELF_ID);
  return (
    <main className="fixed inset-0 bg-gray-950 text-white flex flex-col overflow-y-auto">
      {/* ヘッダー */}
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50 px-4 py-3">
        <h1 className="text-lg font-bold text-center">ZERO-PAIN</h1>
      </header>

      <div className="flex-1 px-4 py-5 space-y-5 max-w-md w-full mx-auto">
        <InstallBanner />

        {/* AIカウンセリング */}
        <button
          onClick={() => onNavigate("ai-counsel")}
          className="btn-3d w-full px-5 py-4 bg-gradient-to-b from-blue-400 via-blue-600 to-purple-800 rounded-2xl font-bold text-left flex items-center gap-4 shadow-[0_10px_30px_rgba(79,70,229,0.5)]"
        >
          <span className="text-3xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">🤖</span>
          <div>
            <p className="text-base font-bold drop-shadow-sm">ZERO-PAIN AIに相談する</p>
            <p className="text-xs font-normal opacity-80">症状を聞き取り、最適なケアを提案します</p>
          </div>
        </button>

        {/* 症状選択 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">セルフケアメニュー</h2>
          <div className="grid grid-cols-2 gap-3">
            {SYMPTOMS.map((symptom) => (
              <button
                key={symptom.id}
                onClick={() => onSelectSymptom(symptom.id)}
                className="card-3d font-semibold rounded-2xl bg-gray-900 overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={symptom.icon} alt={symptom.label} className="w-full aspect-square object-cover" />
                <p className="text-sm font-bold py-2.5 text-center text-white bg-gradient-to-b from-gray-700 to-gray-900 border-t border-gray-600/30">{symptom.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 全身チェック */}
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">姿勢チェック</h2>
          <button
            onClick={() => onNavigate("check")}
            className="btn-3d w-full px-5 py-5 bg-gradient-to-b from-orange-400 via-orange-600 to-amber-800 rounded-2xl font-semibold flex items-center gap-4 shadow-[0_10px_30px_rgba(234,88,12,0.5)]"
          >
            <span className="text-4xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">🧍</span>
            <div className="text-left">
              <p className="text-base font-bold drop-shadow-sm">ZERO-PAIN AIで姿勢スキャン</p>
              <p className="text-xs font-normal opacity-80">スマホを置いて全身撮影 → 歪みを自動診断</p>
            </div>
          </button>
          <button
            onClick={() => onNavigate("history")}
            disabled={records.length === 0}
            className="btn-3d w-full px-5 py-3.5 bg-gradient-to-b from-indigo-500 via-indigo-700 to-indigo-900 disabled:from-gray-800 disabled:to-gray-900 disabled:opacity-40 rounded-2xl font-semibold flex items-center gap-3 shadow-[0_10px_24px_rgba(67,56,202,0.4)]"
          >
            <span className="text-xl drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">📊</span>
            <div className="text-left">
              <p className="text-sm font-semibold">過去の記録を見る</p>
              <p className="text-[11px] text-indigo-300">
                {records.length > 0 ? `${records.length}件の記録` : "まだ記録がありません"}
              </p>
            </div>
          </button>
        </div>

        {/* LINE予約 */}
        <a
          href="https://lin.ee/TKHXNpJn"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-3d w-full px-5 py-4 bg-gradient-to-b from-[#2BE06A] via-[#06C755] to-[#048A3A] rounded-2xl font-semibold flex items-center gap-4 shadow-[0_10px_30px_rgba(6,199,85,0.5)]"
        >
          <svg viewBox="0 0 120 120" className="w-10 h-10 flex-shrink-0" fill="white">
            <path d="M60 0C26.86 0 0 22.39 0 50c0 24.72 21.94 45.43 51.58 49.33 2.01.43 4.74 1.33 5.43 3.05.62 1.56.41 4.01.2 5.59l-.88 5.27c-.27 1.56-1.24 6.11 5.35 3.33s35.6-20.96 48.57-35.89h-.01C118.24 71.67 120 61.27 120 50 120 22.39 93.14 0 60 0zm-26.99 64.64h-9.93c-1.82 0-3.3-1.48-3.3-3.3V34.56c0-1.82 1.48-3.3 3.3-3.3s3.3 1.48 3.3 3.3v23.48h6.63c1.82 0 3.3 1.48 3.3 3.3s-1.48 3.3-3.3 3.3zm12.18-3.3c0 1.82-1.48 3.3-3.3 3.3s-3.3-1.48-3.3-3.3V34.56c0-1.82 1.48-3.3 3.3-3.3s3.3 1.48 3.3 3.3v26.78zm27.94 0c0 1.37-.85 2.6-2.13 3.09-.39.15-.79.22-1.18.22-.98 0-1.93-.44-2.56-1.23l-13.02-17.74v15.66c0 1.82-1.48 3.3-3.3 3.3s-3.3-1.48-3.3-3.3V34.56c0-1.37.85-2.6 2.13-3.09.39-.15.79-.22 1.18-.22.98 0 1.93.44 2.56 1.23l13.02 17.74V34.56c0-1.82 1.48-3.3 3.3-3.3s3.3 1.48 3.3 3.3v26.78zm18.18-17.55c1.82 0 3.3 1.48 3.3 3.3s-1.48 3.3-3.3 3.3h-6.63v6.63h6.63c1.82 0 3.3 1.48 3.3 3.3s-1.48 3.3-3.3 3.3h-9.93c-1.82 0-3.3-1.48-3.3-3.3V34.56c0-1.82 1.48-3.3 3.3-3.3h9.93c1.82 0 3.3 1.48 3.3 3.3s-1.48 3.3-3.3 3.3h-6.63v6.63h6.63z"/>
          </svg>
          <div className="text-left">
            <p className="text-base font-bold">LINEで予約・確認・変更</p>
            <p className="text-xs font-normal opacity-80">ご予約はこちらから</p>
          </div>
        </a>
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  // 初回メッセージ
  useEffect(() => {
    async function firstMessage() {
      setLoading(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [], deviceId: getDeviceId() }),
        });
        const data = await res.json();
        if (data.message) {
          setMessages([{ role: "assistant", content: data.message }]);
        }
      } catch {
        const fallback = "こんにちは！今日はどんな症状が気になりますか？お気軽にお話しください。";
        setMessages([{ role: "assistant", content: fallback }]);
      }
      setLoading(false);
    }
    firstMessage();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          deviceId: getDeviceId(),
        }),
      });
      const data = await res.json();
      if (data.message) {
        setMessages([...newMessages, { role: "assistant", content: data.message }]);
        // DBに保存
        saveToDb({ type: "chat", role: "user", content: userMsg.content });
        saveToDb({ type: "chat", role: "assistant", content: data.message, recommendedSymptom: data.recommendedSymptomId });
      }
      if (data.recommendedSymptomId) {
        setRecommendedId(data.recommendedSymptomId);
      }
    } catch {
      setMessages([...newMessages, { role: "assistant", content: "すみません、通信エラーが発生しました。もう一度お試しください。" }]);
    }
    setLoading(false);
  };

  const recommendedSymptom = SYMPTOMS.find((s) => s.id === recommendedId);

  return (
    <main className="fixed inset-0 bg-gray-950 text-white flex flex-col">
      <header className="sticky top-0 z-10 bg-gray-950/95 backdrop-blur-sm border-b border-gray-800/50 px-4 py-3 flex items-center gap-3">
        <button onClick={() => onNavigate("home")} className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm">← 戻る</button>
        <h1 className="text-base font-bold">ZERO-PAIN AIカウンセリング</h1>
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
              {msg.role === "assistant" && <p className="text-xs text-gray-400 mb-1">🤖 ZERO-PAIN AI</p>}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 px-4 py-3 rounded-2xl rounded-bl-md">
              <p className="text-xs text-gray-400 mb-1">🤖 ZERO-PAIN AI</p>
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

      {/* LINE予約導線 */}
      {messages.length >= 4 && (
        <div className="max-w-md w-full mx-auto mb-3 px-4">
          <a
            href="https://lin.ee/TKHXNpJn"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full px-4 py-3 bg-[#06C755] hover:bg-[#05b04c] active:bg-[#04a044] rounded-xl font-semibold text-sm flex items-center gap-3 text-white block text-center"
          >
            <span className="text-2xl">💬</span>
            <div className="text-left">
              <p className="font-bold">改善しない場合はプロにお任せ</p>
              <p className="text-xs opacity-90">LINEから予約する</p>
            </div>
          </a>
        </div>
      )}

      {/* 入力エリア */}
      <div className="border-t border-gray-800 px-4 py-3 max-w-md w-full mx-auto flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !("isComposing" in e.nativeEvent && e.nativeEvent.isComposing)) sendMessage(); }}
          placeholder="症状を入力..."
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

  return (
    <main className="fixed inset-0 bg-gray-950 overflow-y-auto text-white flex flex-col items-center p-4 pb-20">
      <div className="flex items-center gap-3 mb-4 w-full max-w-md">
        <button onClick={() => onNavigate("home")} className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm">← 戻る</button>
        <h1 className="text-lg font-bold">セルフケア</h1>
      </div>

      <p className="text-gray-400 text-sm mb-4 w-full max-w-md">
        気になる症状を選んでください
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

      {activeSymptom && (
        <div className="w-full max-w-md mt-6">
          <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <h3 className="font-bold text-base mb-1">{activeSymptom.videoTitle}</h3>
            <p className="text-gray-400 text-xs mb-3">{activeSymptom.description}</p>
            <div className="relative w-full aspect-video rounded-lg overflow-hidden bg-black">
              <iframe
                src={`${activeSymptom.videoUrl}?rel=0&modestbranding=1`}
                title={activeSymptom.videoTitle}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <button
              onClick={() => setSelectedId(null)}
              className="mt-3 w-full py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
            >
              閉じる
            </button>
            <a
              href="https://lin.ee/TKHXNpJn"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 w-full py-3 bg-[#06C755] hover:bg-[#05b04c] rounded-lg text-sm font-semibold flex items-center justify-center gap-2 text-white block"
            >
              💬 改善しない場合はLINEで予約
            </a>
          </div>
        </div>
      )}
    </main>
  );
}

// ==================== 音声ガイド ====================
// テキストのキーワードに対応する音声ファイル
const VOICE_KEYWORDS: { keyword: string; file: string }[] = [
  { keyword: "全身が映る", file: "/voice-stand.mp3" },
  { keyword: "カメラの前に立って", file: "/voice-stand.mp3" },
  { keyword: "横向きのままカメラの前", file: "/voice-stand.mp3" },
  { keyword: "足元が映る", file: "/voice-back.mp3" },
  { keyword: "離れて", file: "/voice-back.mp3" },
  { keyword: "近づいて", file: "/voice-closer.mp3" },
  { keyword: "右に移動", file: "/voice-right.mp3" },
  { keyword: "左に移動", file: "/voice-left.mp3" },
  { keyword: "ストップ", file: "/voice-stop.mp3" },
  { keyword: "撮影しました", file: "/voice-done.mp3" },
];

// 全音声ファイルをプリロード
const ALL_VOICE_FILES = [
  "/voice-stand.mp3", "/voice-back.mp3", "/voice-closer.mp3",
  "/voice-right.mp3", "/voice-left.mp3", "/voice-stop.mp3",
  "/voice-5.mp3", "/voice-4.mp3", "/voice-3.mp3",
  "/voice-2.mp3", "/voice-1.mp3", "/voice-done.mp3",
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

    if (file) {
      // 音声ファイルで再生
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
    } else {
      // 音声ファイルにマッチしない場合 → Web Speech APIで読み上げ
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        isSpeaking = true;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "ja-JP";
        utterance.rate = 1.0;
        utterance.onend = () => { isSpeaking = false; };
        utterance.onerror = () => { isSpeaking = false; };
        window.speechSynthesis.speak(utterance);
      }
    }
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
      setGuideText("次は側面の撮影です。体を横向きにしてください");
      speak("次は側面の写真撮影をします。体を横向きにしてください。", true);
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

    speak("ストップ", true);
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
      speak("正面の撮影が完了しました。次は側面の写真撮影をしますので、体を横向きにしてください。", true);
      setGuideBorderColor("border-blue-500");
      setTimeout(() => {
        startGuideForStep.current = "side";
        startGuide();
      }, 5000);
    } else if (currentStep === "side") {
      // 横向き撮影完了
      drawSideDiagnosisOverlay(ctx, lm, canvas.width, canvas.height);
      const sideResults = analyzeSidePosture(lm);
      setDiagnosis([...frontDiagnosisRef.current, ...sideResults]);
      setCaptureStep("done");
      captureStepRef.current = "done";
      setCaptured(true);
      setLoading(false);
      speak("横向きの撮影が完了しました。診断結果をご確認ください。", true);
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
          speak("正面の撮影が完了しました。次は側面の写真撮影をしますので、体を横向きにしてください。", true);
          setTimeout(() => {
            startGuideForStep.current = "side";
            startGuide();
          }, 5000);
          return;
        } else if (manualStep === "side") {
          drawSideDiagnosisOverlay(ctx, lm, canvas.width, canvas.height);
          const sideResults = analyzeSidePosture(lm);
          setDiagnosis([...frontDiagnosisRef.current, ...sideResults]);
          setCaptureStep("done");
          captureStepRef.current = "done";
          speak("横向きの撮影が完了しました。診断結果をご確認ください。", true);
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
        <div className="w-full max-w-md mt-4 space-y-2">
          <h2 className="text-lg font-bold mb-2">診断結果</h2>
          {diagnosis.map((item, i) => (
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
