"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("zero_pain_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("zero_pain_device_id", id);
  }
  return id;
}

type Category = "feature" | "bug" | "account" | "feedback" | "other";

const CATEGORY_OPTIONS: Array<{ value: Category; label: string; emoji: string }> = [
  { value: "feature", label: "機能について", emoji: "💡" },
  { value: "bug", label: "不具合・バグ報告", emoji: "🐛" },
  { value: "account", label: "アカウント・課金", emoji: "💳" },
  { value: "feedback", label: "要望・提案", emoji: "📣" },
  { value: "other", label: "その他", emoji: "❓" },
];

type FAQItem = {
  q: string;
  a: string;
  category: string;
};

const FAQ_ITEMS: FAQItem[] = [
  // アカウント・設定
  {
    category: "🔧 アカウント・設定",
    q: "アカウントを削除するには？",
    a: "「設定」画面の下部にある「🗑 アカウントを削除」ボタンから削除できます。「DELETE」と入力後、プロフィール・姿勢チェック記録・食事記録・チャット履歴など、関連するすべてのデータが完全に削除されます。この操作は取り消せませんのでご注意ください。",
  },
  {
    category: "🔧 アカウント・設定",
    q: "登録情報（名前・体重など）を変更したい",
    a: "身長・体重・目標などは「食事メニュー」→「プロフィール & 目標」画面からいつでも変更できます。お名前などの基本情報変更は現在対応中ですので、サポートまでお問い合わせください。",
  },
  {
    category: "🔧 アカウント・設定",
    q: "機種変更時のデータ移行は可能ですか？",
    a: "現在、端末ごとのアカウントとなっており、機種変更時のデータ移行機能は実装中です。重要なデータは「設定」→「📥 データをエクスポート」からJSONファイルとしてダウンロードしておくことをおすすめします。",
  },
  // サブスク・課金
  {
    category: "💳 サブスク・課金",
    q: "サブスクリプションを解約するには？",
    a: "iPhoneの「設定」→ Apple ID（最上部）→「サブスクリプション」から解約できます。解約後も、次回更新日まではプレミアム機能をご利用いただけます。アプリ内の「プラン管理」画面からも同様の操作が可能です。",
  },
  {
    category: "💳 サブスク・課金",
    q: "無料トライアル後の課金タイミングは？",
    a: "7日間の無料トライアル終了時に自動的に有料プランへ切り替わります。トライアル中に解約すれば課金は発生しません。Apple App Storeの規約に従い、トライアル終了24時間前までに解約手続きをお願いします。",
  },
  {
    category: "💳 サブスク・課金",
    q: "返金を希望します",
    a: "Apple App Store経由で購入されたサブスクリプションの返金は、Apple社の規約に従います。https://reportaproblem.apple.com/ から直接Appleにリクエストいただくか、サポートフォームからお問い合わせください。",
  },
  {
    category: "💳 サブスク・課金",
    q: "月額と年額、どちらがお得ですか？",
    a: "年額プラン（¥12,800/年）は月額プラン（¥1,280/月）と比較して月額換算 ¥1,067 となり、約17%（2ヶ月分）お得です。長期継続を予定されている方には年額プランをおすすめします。",
  },
  // 姿勢チェック
  {
    category: "🧍 姿勢チェック",
    q: "カメラが起動しません",
    a: "Safari の「設定」→「カメラ」でアクセス許可を確認してください。また、HTTPSで接続しているか、他のアプリがカメラを使用していないかもご確認ください。問題が続く場合は、一度ブラウザを再起動してみてください。",
  },
  {
    category: "🧍 姿勢チェック",
    q: "姿勢チェックの精度はどれくらい？",
    a: "本アプリはGoogle MediaPipe技術を用いた骨格推定により、一般的な姿勢の傾向を分析します。医療的な精密診断ではなく、セルフケアの参考情報としてご活用ください。撮影時は明るい場所で、全身が映るよう距離を調整すると精度が向上します。",
  },
  {
    category: "🧍 姿勢チェック",
    q: "無料プランで何回まで使える？",
    a: "無料プランでは、姿勢チェックが月3回、AIチャットが月5回、食事分析が月3回までご利用いただけます。プレミアムプランならすべての機能が無制限でご利用可能です。",
  },
  // AIカウンセラー
  {
    category: "🦴 ガイコツ先生（AI）",
    q: "過去の会話を削除したい",
    a: "アカウント全体を削除すると、チャット履歴もすべて削除されます。個別の会話のみ削除する機能は現在対応中です。ご希望の場合はサポートフォームからお知らせください。",
  },
  {
    category: "🦴 ガイコツ先生（AI）",
    q: "会話の内容は誰が見ていますか？",
    a: "AI分析のためにAnthropic社（Claude API提供元）のサーバーに送信されます。Anthropic社は学習目的でのデータ利用は行いません。プライバシーポリシーに詳しく記載していますのでご確認ください。",
  },
  {
    category: "🦴 ガイコツ先生（AI）",
    q: "AIの回答が不適切な場合",
    a: "AIによる回答は参考情報であり、正確性を保証するものではありません。不適切な回答があった場合はサポートフォームからご報告ください。継続的に改善してまいります。",
  },
  // 食事記録
  {
    category: "🍱 食事記録",
    q: "食事が正しく認識されません",
    a: "明るい場所で、食事全体が写るように撮影すると精度が向上します。パッケージの文字（ブランド名・商品名）が見える写真だと、より正確に分析できます。認識ミスがあった場合は申し訳ありません、現在精度向上に取り組んでいます。",
  },
  {
    category: "🍱 食事記録",
    q: "iPhoneの HEIC 写真が読み込めません",
    a: "本アプリは HEIC 形式を自動で JPEG に変換します。もし読み込みエラーが出る場合は、iPhoneの「設定」→「カメラ」→「フォーマット」→「互換性優先」に変更すると確実にJPEG形式で撮影できます。",
  },
  {
    category: "🍱 食事記録",
    q: "記録を編集・削除したい",
    a: "個別の食事記録の編集・削除機能は現在対応中です。急ぎで必要な場合はサポートフォームからお知らせください。",
  },
  // プライバシー・その他
  {
    category: "🔒 プライバシー・その他",
    q: "プライバシーは守られますか？",
    a: "はい。すべての通信はHTTPSで暗号化され、データは暗号化されたSupabaseデータベースに保存されます。個人を特定する情報と端末IDは紐付かないように設計されています。詳しくはプライバシーポリシーをご確認ください。",
  },
  {
    category: "🔒 プライバシー・その他",
    q: "本アプリは医療機関と関係ありますか？",
    a: "本アプリはセルフケア支援アプリであり、医療機関ではありません。ストレッチや栄養のアドバイスはカイロプラクターの一般的な知見に基づく参考情報です。重篤な症状や急激な体調変化がある場合は、必ず医療機関を受診してください。",
  },
  {
    category: "🔒 プライバシー・その他",
    q: "オフラインで使えますか？",
    a: "姿勢チェック（カメラ＋MediaPipe）の一部はオフラインで動作しますが、AIチャット・食事分析・痛み予測などはインターネット接続が必要です。",
  },
  {
    category: "🔒 プライバシー・その他",
    q: "広告は表示されますか？",
    a: "ZERO-PAINは広告を一切表示しません。サブスクリプション収益のみで運営しています。",
  },
];

export default function SupportPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  // 登録済みユーザーなら名前をプリフィル
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/user-profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId: getDeviceId() }),
        });
        const data = await res.json();
        if (data.registered && data.user?.name) {
          setName(data.user.name);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("お名前を入力してください");
      return;
    }
    if (!email.trim()) {
      setErrorMsg("メールアドレスを入力してください");
      return;
    }
    if (!category) {
      setErrorMsg("カテゴリを選択してください");
      return;
    }
    if (!message.trim() || message.trim().length < 5) {
      setErrorMsg("お問い合わせ内容を5文字以上入力してください");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          subject: subject.trim() || null,
          message: message.trim(),
          deviceId: getDeviceId(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "送信失敗");
      setSubmitted(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "送信失敗");
    } finally {
      setSubmitting(false);
    }
  };

  // FAQ をカテゴリ別にグループ化
  const groupedFAQ = FAQ_ITEMS.reduce<Record<string, FAQItem[]>>((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {});

  if (submitted) {
    return (
      <main className="min-h-screen bg-gray-950 text-white flex flex-col">
        <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
          >
            ← 戻る
          </Link>
          <h1 className="text-base font-bold">💬 サポート</h1>
        </header>

        <div className="flex-1 flex items-center justify-center px-6 py-10">
          <div className="card-accent-emerald p-6 max-w-sm w-full text-center space-y-4">
            <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="white"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-10 h-10"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h2 className="text-xl font-extrabold text-white">受け付けました</h2>
            <p className="text-sm text-emerald-100 leading-relaxed">
              お問い合わせありがとうございます。
              <br />
              通常 3 営業日以内にご返信いたします。
            </p>
            <div className="pt-2">
              <Link
                href="/"
                className="btn-primary inline-block px-6 py-3 text-sm"
              >
                ホームに戻る
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
        >
          ← 戻る
        </Link>
        <h1 className="text-base font-bold">💬 サポート</h1>
      </header>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-6">
        {/* FAQ セクション */}
        <section className="space-y-3">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <span>❓</span>
            <span>よくあるご質問</span>
          </h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            お問い合わせ前に、まずはこちらをご確認ください。
          </p>

          {Object.entries(groupedFAQ).map(([cat, items]) => (
            <div key={cat} className="space-y-2">
              <p className="text-[11px] text-gray-500 font-bold tracking-wide mt-3 pl-1">
                {cat}
              </p>
              {items.map((item, i) => {
                const globalIdx = FAQ_ITEMS.indexOf(item);
                const isOpen = expandedFAQ === globalIdx;
                return (
                  <button
                    key={i}
                    onClick={() =>
                      setExpandedFAQ(isOpen ? null : globalIdx)
                    }
                    className="card-base w-full text-left p-3 transition active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-white flex-1">
                        Q. {item.q}
                      </p>
                      <span
                        className={`text-gray-500 text-lg transition-transform ${
                          isOpen ? "rotate-180" : ""
                        }`}
                      >
                        ▾
                      </span>
                    </div>
                    {isOpen && (
                      <p className="mt-2 pt-2 border-t border-white/5 text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
                        {item.a}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </section>

        {/* お問い合わせフォーム */}
        <section className="pt-4 border-t border-white/5 space-y-4">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>📮</span>
              <span>お問い合わせフォーム</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              ご質問や不具合のご報告は以下のフォームからお送りください。
              <br />
              通常 3 営業日以内にご返信いたします。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* 名前 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                お名前 <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例: 山田太郎"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                maxLength={100}
              />
            </div>

            {/* メール */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                メールアドレス <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@mail.com"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                maxLength={255}
              />
              <p className="text-[11px] text-gray-500 mt-1">
                ご返信の際に使用します
              </p>
            </div>

            {/* カテゴリ */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                カテゴリ <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={`px-3 py-2.5 rounded-lg text-xs font-bold text-left flex items-center gap-2 transition ${
                      category === opt.value
                        ? "bg-emerald-600 text-white border border-emerald-400"
                        : "bg-gray-800 text-gray-300 border border-gray-700"
                    }`}
                  >
                    <span className="text-base">{opt.emoji}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 件名（任意） */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                件名（任意）
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="例: カメラが起動しない件"
                className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500"
                maxLength={200}
              />
            </div>

            {/* 本文 */}
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">
                お問い合わせ内容 <span className="text-red-400">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="詳しくお書きください。不具合の場合は発生状況・機種・OSバージョンなど教えていただけると助かります。"
                rows={6}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:border-emerald-500 resize-none"
                maxLength={4000}
              />
              <p className="text-[11px] text-gray-500 mt-1 text-right">
                {message.length} / 4000
              </p>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-red-300">
                ⚠️ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full py-3.5 text-base disabled:opacity-50"
            >
              {submitting ? "送信中..." : "送信する"}
            </button>

            <p className="text-[11px] text-gray-500 leading-relaxed text-center">
              送信いただいた情報は、お問い合わせ対応のみに使用します。
              <br />
              詳しくは
              <Link
                href="/privacy"
                className="text-emerald-400 underline ml-1"
              >
                プライバシーポリシー
              </Link>
              をご確認ください。
            </p>
          </form>
        </section>
      </div>
    </main>
  );
}
