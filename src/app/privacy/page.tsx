"use client";

import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <Link
          href="/"
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
        >
          ← 戻る
        </Link>
        <h1 className="text-base font-bold">プライバシーポリシー</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6 text-sm leading-relaxed text-gray-200">
        <section>
          <p className="text-xs text-gray-400 mb-2">最終更新日: 2026年4月18日</p>
          <p>
            ZERO-PAIN（以下「本アプリ」といいます）は、運営者である TopBank, Inc.（有限会社トップバンク、以下「当方」といいます）が提供するセルフケア支援アプリケーションです。
            本プライバシーポリシーは、本アプリの利用に関連して当方が取得する情報の取り扱いについて定めるものです。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">1. 事業者情報</h2>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>事業者名: TopBank, Inc.（有限会社トップバンク）</li>
            <li>お問い合わせ: アプリ内の<a href="/support" className="text-emerald-400 underline">サポート画面</a>からお問い合わせください</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">2. 取得する情報</h2>
          <p className="mb-2">本アプリでは以下の情報を取得・保存します。</p>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li><strong className="text-white">基本プロフィール</strong>: お名前（ニックネーム可）、都道府県、年齢、性別、身長、体重、活動レベル</li>
            <li><strong className="text-white">お悩み情報</strong>: 気になる痛みの部位、お悩み内容</li>
            <li><strong className="text-white">姿勢チェックデータ</strong>: 姿勢写真、骨格座標データ、チェック結果</li>
            <li><strong className="text-white">食事記録データ</strong>: 食事写真、推定カロリー、栄養素、食事区分</li>
            <li><strong className="text-white">体重記録</strong>: 体重の推移データ</li>
            <li><strong className="text-white">栄養目標</strong>: 目標カロリー、タンパク質等の目標値</li>
            <li><strong className="text-white">チャット会話履歴</strong>: ガイコツ先生（AIカウンセラー）とのやり取り</li>
            <li><strong className="text-white">利用履歴</strong>: 機能の利用回数、症状選択履歴</li>
            <li><strong className="text-white">端末識別子（device_id）</strong>: 端末を識別するランダムID（個人を特定する情報ではありません）</li>
            <li><strong className="text-white">サブスクリプション情報</strong>: プラン状態、トライアル情報</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">3. 利用目的</h2>
          <p className="mb-2">取得した情報は以下の目的で利用します。</p>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>姿勢チェック・食事分析機能の提供</li>
            <li>AIカウンセラー「ガイコツ先生」によるパーソナライズされたセルフケア提案</li>
            <li>栄養目標・体重管理のサポート</li>
            <li>利用状況の分析および本アプリの改善</li>
            <li>サブスクリプションの管理</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">4. 第三者への提供（外部サービス利用）</h2>
          <p className="mb-2">本アプリは以下の外部サービスを利用しています。各サービスのプライバシーポリシーは各社のウェブサイトをご確認ください。</p>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>
              <strong className="text-white">Anthropic, PBC（Claude API）</strong>: AIカウンセリング・姿勢写真分析・食事写真分析に利用。
              会話内容と画像がAnthropicに送信されます。Anthropicは学習目的でのデータ利用を行いません。
            </li>
            <li>
              <strong className="text-white">OpenAI, Inc.（OpenAI API）</strong>: 音声ガイド生成に利用。
            </li>
            <li>
              <strong className="text-white">Supabase Inc.</strong>: データベース・画像ストレージとして利用。データは暗号化され米国のデータセンターに保存されます。
            </li>
            <li>
              <strong className="text-white">Vercel Inc.</strong>: アプリの配信インフラとして利用。
            </li>
            <li>
              <strong className="text-white">RevenueCat, Inc.</strong>: サブスクリプション課金状態の管理・購入履歴の検証に利用。
              端末識別子（device_id）と購入レシート情報を RevenueCat のサーバーに送信し、Apple App Store のサブスクリプション情報を取得・検証します。
              （詳細: <a href="https://www.revenuecat.com/privacy/" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">RevenueCat プライバシーポリシー</a>）
            </li>
            <li>
              <strong className="text-white">Apple Inc.（App Store / StoreKit）</strong>: 有料プランの決済処理。
              支払い情報（カード番号等）はApple社が直接管理し、当社には一切送信されません。
              当社が受け取るのは「購入が成功したか」「サブスクリプションが有効か」という情報のみです。
            </li>
          </ul>
          <p className="mt-2 text-gray-300">
            上記以外の第三者への個人情報の提供・販売は一切行いません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">4-1. サブスクリプション・決済情報の取り扱い</h2>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>有料プランの決済はすべて Apple App Store 経由で行われます。当社はクレジットカード番号・銀行口座等の決済情報を一切取得・保存しません。</li>
            <li>当社が保管するのは「サブスクリプションの状態（無料/トライアル/月額/年額/解約予定）」「契約期間」「RevenueCat の取引ID」のみです。</li>
            <li>サブスクリプションの解約・返金リクエストは Apple ID のアカウント設定または Apple サポートからお手続きください。当社では決済関連のお問い合わせには対応できません。</li>
            <li>家族プラン機能では、家族グループ内のメンバー間でサブスクリプション状態（無料/プレミアム）の共有を行います。決済情報自体は共有しません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">5. データの保存期間</h2>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>アカウント有効期間中は継続して保存します</li>
            <li>アカウント削除のリクエスト受領後、30日以内に完全削除します</li>
            <li>法令により保存が義務付けられているものを除き、ご本人のリクエストに応じ速やかに削除します</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">6. ユーザーの権利</h2>
          <p className="mb-2">ユーザー様は以下の権利を有します。</p>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>自身のデータの閲覧・エクスポート</li>
            <li>自身のデータの訂正・削除</li>
            <li>アカウントの削除（アプリ内「設定」画面から実行可能）</li>
            <li>データ処理に関する異議申し立て</li>
          </ul>
          <p className="mt-2 text-gray-300">
            アプリ内「設定」画面から、いつでもアカウント削除・データエクスポートが可能です。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">7. セキュリティ</h2>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>すべての通信はHTTPS（TLS）で暗号化されています</li>
            <li>データベース・画像ストレージは暗号化された状態で保管されます</li>
            <li>APIアクセスキーはサーバー側のみに保管され、クライアントからはアクセスできません</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">8. 健康情報に関する重要なお知らせ</h2>
          <div className="card-accent-amber p-4 space-y-2">
            <p className="font-bold text-amber-300">⚠️ 本アプリは医療行為ではありません</p>
            <p className="text-gray-200">
              本アプリが提供するセルフケアの提案・栄養アドバイス・姿勢のチェック結果は、
              カイロプラクターの一般的な知見に基づく参考情報であり、医学的な診断・治療・医療的助言を提供するものではありません。
            </p>
            <p className="text-gray-200">
              重篤な痛み・しびれ・めまい・急激な体調変化等がある場合は、必ず医療機関を受診してください。
              妊娠中の方、持病のある方、薬を服用中の方は、本アプリの利用前にかかりつけ医にご相談ください。
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">9. 未成年者の利用</h2>
          <p className="text-gray-300">
            本アプリは13歳以上の方のご利用を推奨しております。
            未成年の方がご利用になる場合は、保護者の方の同意を得たうえでご利用ください。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">10. Cookieおよび端末識別子</h2>
          <p className="text-gray-300">
            本アプリは、端末に固有のランダムなIDを生成して端末内に保存します。
            このIDは個人を特定する情報と紐付きません。
            端末識別のためにのみ使用され、広告トラッキングには利用しません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">11. プライバシーポリシーの変更</h2>
          <p className="text-gray-300">
            本プライバシーポリシーは、法令変更やサービス改善等に伴い予告なく変更される場合があります。
            重要な変更がある場合は、アプリ内で通知します。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">12. お問い合わせ</h2>
          <p className="text-gray-300">
            本プライバシーポリシーおよびデータ取扱いに関するご質問は、
            <a href="/support" className="text-emerald-400 underline">アプリ内のサポート画面</a>
            からお問い合わせください。
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
