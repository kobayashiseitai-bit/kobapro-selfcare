'use client';

import { useState } from 'react';

// 2026-10-01: Android（Google Play）でも公開中のため、iPhone 前提の答えを両方に合わせた。
// 無料体験の申し込み場所は、アプリのメニュー名「料金プラン・7日間無料体験」に合わせる。
// 家族プランのコードは、アプリの呼び方に合わせて「家族コード」と書く。
// 無料体験の終了日時の確かめ先は、すべての方に確実に出るストアの「サブスクリプション（定期購入）」画面にする
// （アプリの料金プラン画面に締め切りが出るのは、Webhook がお試しを status='trial' で保存した方だけのため）。
const FAQS = [
  {
    q: '無料で始められますか？',
    a: 'アプリのダウンロードは無料です。はじめての方は7日間の無料体験つきで、アプリの「メニュー」→「料金プラン・7日間無料体験」から申し込めます（お支払いの登録は App Store / Google Play の画面で行います）。無料体験が終わる24時間前までに解約すれば料金はかかりません。解約しない場合は、無料体験の終了後に自動で有料プランに切り替わり、プランの料金がかかります。無料体験の終了日時は App Store / Google Play のサブスクリプション（定期購入）画面に表示されます。その24時間前までに解約してください。',
  },
  {
    q: '解約はいつでもできますか？',
    a: 'はい。iPhone は「設定」→ いちばん上の自分の名前 →「サブスクリプション」、Android は Google Play ストア → プロフィール →「お支払いと定期購入」→「定期購入」から、いつでも解約できます。アプリを削除しただけでは解約になりません。次回更新日の24時間前までに手続きすれば、追加料金は発生しません。',
  },
  {
    q: 'AI 姿勢分析はどのくらい正確ですか？',
    a: '正面・側面の全身写真から、頭部・肩・骨盤・膝などの主要なランドマークを検出して骨格バランスを評価します。医療診断ではなくセルフケア目的の参考情報としてご利用ください。',
  },
  {
    q: '家族プランは何人まで使えますか？',
    a: '1契約でオーナーを含めて最大4人まで利用できます。アプリ内で発行される「家族コード」を家族に送り、家族はアプリの「メニュー」→「家族プラン」→「家族コードで参加する」から入力するだけで、それぞれのスマホでプレミアム機能が使えるようになります。',
  },
  {
    q: '個人情報や写真は安全ですか？',
    a: 'すべての通信は HTTPS で暗号化され、姿勢分析用の写真はあなたの端末とサーバーの分析処理のみで使用します。第三者への販売や広告利用は一切ありません。詳細はプライバシーポリシーをご確認ください。',
  },
  {
    q: 'Apple ヘルスケアと連携できますか？',
    a: 'Apple ヘルスケア（HealthKit）との連携機能は現在開発中で、今後のアップデートで提供予定です。歩数・睡眠などのデータを姿勢ケアのヒントとして活用できるようになります。',
  },
  {
    q: 'Android や iPad でも使えますか？',
    a: 'iPhone・Android の両方で使えます。iPhone は App Store（iOS 16.6 以上）、Android は Google Play からダウンロードしてください。iPad には対応していません。',
  },
  {
    q: '医療行為や治療目的で使えますか？',
    a: 'ZERO-PAIN はセルフケアを支援するアプリで、医療診断・治療を目的としたものではありません。痛みが続く場合は必ず医療機関を受診してください。',
  },
];

export default function Faq() {
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="space-y-3">
      {FAQS.map((item, idx) => {
        const isOpen = openIdx === idx;
        return (
          <div
            key={idx}
            className="rounded-2xl border border-emerald-100 bg-white shadow-sm overflow-hidden transition-shadow hover:shadow-md"
          >
            <button
              onClick={() => setOpenIdx(isOpen ? null : idx)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="font-semibold text-slate-900 text-base sm:text-lg">
                Q. {item.q}
              </span>
              <span
                className={`flex-shrink-0 w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-lg font-bold transition-transform ${
                  isOpen ? 'rotate-45' : ''
                }`}
                aria-hidden
              >
                +
              </span>
            </button>
            {isOpen && (
              <div className="px-5 pb-5 -mt-1">
                <p className="text-slate-600 leading-relaxed text-sm sm:text-base">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
