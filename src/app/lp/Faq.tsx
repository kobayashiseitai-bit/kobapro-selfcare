'use client';

import { useState } from 'react';

const FAQS = [
  {
    q: '本当に無料で始められますか？',
    a: '7日間の無料トライアル中は一切料金がかかりません。期間中にいつでもキャンセル可能で、その場合は課金されません。継続される場合のみ、トライアル終了後に自動でプランの料金が課金されます。',
  },
  {
    q: '解約はいつでもできますか？',
    a: 'はい。iPhone の「設定」→「Apple ID」→「サブスクリプション」からいつでも解約できます。次回更新日の24時間前までに手続きすれば、追加料金は発生しません。',
  },
  {
    q: 'AI 姿勢分析はどのくらい正確ですか？',
    a: '正面・側面の全身写真から、頭部・肩・骨盤・膝などの主要なランドマークを検出して骨格バランスを評価します。医療診断ではなくセルフケア目的の参考情報としてご利用ください。',
  },
  {
    q: '家族プランは何人まで使えますか？',
    a: '1契約でオーナーを含めて最大4人まで利用できます。アプリ内で発行される招待コードを家族に共有するだけで、それぞれの iPhone でプレミアム機能が解放されます。',
  },
  {
    q: '個人情報や写真は安全ですか？',
    a: 'すべての通信は HTTPS で暗号化され、姿勢分析用の写真はあなたの端末とサーバーの分析処理のみで使用します。第三者への販売や広告利用は一切ありません。詳細はプライバシーポリシーをご確認ください。',
  },
  {
    q: 'Apple ヘルスケアと連携できますか？',
    a: 'Apple ヘルスケア（HealthKit）との連携機能は現在開発中で、今後のアップデートで提供予定です。歩数・睡眠などのデータを姿勢改善のヒントとして活用できるようになります。',
  },
  {
    q: 'iPad や Android でも使えますか？',
    a: '現在は iPhone 専用です。Android 版・iPad 対応は今後のアップデートで検討しています。',
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
