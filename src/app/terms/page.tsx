"use client";

import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
        >
          ← 戻る
        </Link>
        <h1 className="text-base font-bold">利用規約</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6 text-sm leading-relaxed text-gray-200">
        <section>
          <p className="text-xs text-gray-400 mb-2">最終更新日: 2026年4月18日</p>
          <p>
            この利用規約（以下「本規約」といいます）は、TopBank, Inc.（有限会社トップバンク、以下「当方」といいます）が提供するセルフケア支援アプリ「ZERO-PAIN」（以下「本アプリ」といいます）の利用条件を定めるものです。ユーザーの皆様（以下「ユーザー」といいます）には、本規約に従って本アプリをご利用いただきます。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第1条（適用）</h2>
          <p>本規約は、ユーザーと当方との間の本アプリの利用に関わる一切の関係に適用されるものとします。</p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第2条（利用登録）</h2>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>本アプリにおいては、利用希望者が本規約に同意のうえ、所定の方法によって利用登録を申請することによって、利用登録が完了するものとします。</li>
            <li>当方は、利用登録の申請者に以下の事由があると判断した場合、登録を拒否することがあります。
              <ul className="mt-1 pl-5 list-disc">
                <li>虚偽の事項を申請した場合</li>
                <li>本規約に違反した経緯がある者からの申請である場合</li>
                <li>その他、当方が利用登録を相当でないと判断した場合</li>
              </ul>
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第3条（本アプリの性質・医療行為との関係）</h2>
          <div className="card-accent-amber p-4 space-y-2 mb-2">
            <p className="font-bold text-amber-300">⚠️ 本アプリは医療行為ではありません</p>
            <p className="text-gray-200">
              本アプリは、カイロプラクターの一般的な知見に基づくセルフケア情報の提供を目的としています。
              医師法その他の医療関連法令に基づく医療行為・診断・治療・処方を行うものではありません。
            </p>
          </div>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>本アプリが提供するストレッチ・エクササイズ・姿勢のチェック結果・栄養アドバイス等は、いずれも一般的な健康維持情報であり、医学的な効能効果を保証するものではありません。</li>
            <li>重篤な痛み・しびれ・めまい・急激な体調変化等の症状がある場合は、ただちに医療機関を受診してください。</li>
            <li>妊娠中の方、持病をお持ちの方、服薬中の方は、本アプリの利用前にかかりつけ医にご相談ください。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第4条（サブスクリプション・自動更新課金）</h2>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>本アプリには無料プランと有料プラン（プレミアムプラン）があります。</li>
            <li>
              <strong className="text-white">プラン内容と料金</strong>:
              <ul className="pl-4 list-disc mt-1 space-y-0.5">
                <li>月額プラン: 1ヶ月あたり 1,280円（税込）</li>
                <li>年額プラン: 1年あたり 12,800円（税込、月換算1,067円）</li>
                <li>初回登録時に7日間の無料トライアルが付与されます</li>
              </ul>
            </li>
            <li>
              <strong className="text-white">支払いタイミング</strong>: 購入確定時にユーザーのApple IDアカウントに料金が請求されます。
            </li>
            <li>
              <strong className="text-white">自動更新</strong>:
              サブスクリプションは、現在の期間が終了する24時間前までに自動更新をオフにしない限り、自動的に同額で更新されます。
              更新の請求は、現在の期間が終了する24時間以内に行われます。
            </li>
            <li>
              <strong className="text-white">プランの管理・解約</strong>:
              サブスクリプションの管理および自動更新の停止は、購入後にApple IDのアカウント設定からいつでも行うことができます。
              （iOSの「設定」アプリ → 自分の名前 → 「サブスクリプション」）
            </li>
            <li>
              <strong className="text-white">無料トライアルの解約</strong>:
              無料トライアル中に解約する場合、トライアル終了の24時間前までに上記の方法で解約手続きを行ってください。
              手続きを行わない場合、トライアル終了時に自動的に有料プランに移行し課金が発生します。
            </li>
            <li>
              <strong className="text-white">返金</strong>:
              返金等の取り扱いは、Apple社の規約に従います。当社では返金処理は行えません。
              （詳細は <a href="https://support.apple.com/ja-jp/HT204084" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">Apple公式の返金リクエスト手順</a> をご参照ください）
            </li>
            <li>
              <strong className="text-white">価格変更</strong>:
              料金プランは予告なく変更される場合があります。価格変更は次回更新時から適用され、Apple のポリシーに従い事前通知されます。
            </li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第5条（禁止事項）</h2>
          <p className="mb-2">ユーザーは、本アプリの利用にあたり、以下の行為をしてはなりません。</p>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>法令または公序良俗に違反する行為</li>
            <li>犯罪行為に関連する行為</li>
            <li>本アプリの内容等、本アプリに含まれる著作権、商標権等の知的財産権を侵害する行為</li>
            <li>当方、他のユーザー、または第三者の名誉、信用を毀損する行為</li>
            <li>本アプリのサーバーまたはネットワークの機能を破壊したり、妨害したりする行為</li>
            <li>本アプリの運営を妨害するおそれのある行為</li>
            <li>不正アクセスをし、またはこれを試みる行為</li>
            <li>他のユーザーに成りすます行為</li>
            <li>本アプリ、その他当方のサービスに関連して、反社会的勢力に対して直接または間接に利益を供与する行為</li>
            <li>その他、当方が不適切と判断する行為</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第6条（本アプリの提供の停止等）</h2>
          <p>
            当方は、メンテナンス、天災、通信回線の障害、その他の事由により、本アプリの提供を停止または中断することがあります。
            これによりユーザーに生じた損害について、当方は一切の責任を負いません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第7条（著作権・知的財産権）</h2>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>本アプリおよび関連コンテンツ（キャラクター「ガイコツ先生」を含む）の著作権その他一切の知的財産権は、当方または正当な権利者に帰属します。</li>
            <li>ユーザーが本アプリに投稿・アップロードした姿勢写真・食事写真・テキストの著作権は、ユーザー自身に帰属します。ただし、当方は本アプリの提供・改善のために必要な範囲で無償で利用できるものとします。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第8条（免責事項）</h2>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>当方は、本アプリに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証しておりません。</li>
            <li>当方は、本アプリの利用により生じた、ユーザーの身体的・精神的損害、ユーザー間または第三者との間で生じた紛争について一切の責任を負いません。</li>
            <li>AIによるアドバイス内容は参考情報であり、その正確性・完全性・特定の目的への適合性を保証するものではありません。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第9条（利用規約の変更）</h2>
          <p>
            当方は、必要と判断した場合、ユーザーへの通知なく本規約を変更できるものとします。
            重要な変更がある場合は、アプリ内で通知します。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第10条（準拠法・裁判管轄）</h2>
          <ol className="space-y-1 pl-5 list-decimal text-gray-300">
            <li>本規約の解釈にあたっては、日本法を準拠法とします。</li>
            <li>本アプリに関して紛争が生じた場合には、当方の所在地を管轄する裁判所を専属的合意管轄とします。</li>
          </ol>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">第11条（お問い合わせ）</h2>
          <p>
            本規約に関するお問い合わせは、
            <a href="/support" className="text-emerald-400 underline">アプリ内のサポート画面</a>
            からお願いいたします。
          </p>
        </section>

        <div className="pt-6 pb-12 text-center">
          <Link
            href="/"
            className="inline-block px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
          >
            アプリに戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
