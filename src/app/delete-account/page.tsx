/**
 * アカウント削除のご案内（/delete-account）
 *
 * 2026-10-02 新設。Google Play の「アカウントの削除」の要件に合わせたウェブのページ。
 * Play Console の「アカウントの削除の URL」に https://posture-app-steel.vercel.app/delete-account を入れる。
 * Play が求めること: アプリ名かデベロッパー名／削除を依頼する手順／削除されるデータと残るデータ／保存期間 を目立つように載せる。
 *
 * 書いてあることの根拠（実装を変えたら、このページも見直す）:
 *  - アプリでの削除の手順: src/app/page.tsx の TabBar（右はしの「メニュー」）と AppMenuSheet（「設定」）、
 *    src/app/settings/page.tsx（「データ管理」→「アカウントを削除」→「DELETE」と入力 →「完全に削除する」）
 *  - 削除されるデータ: src/app/api/account/route.ts の DELETE（同じ device_id の users の行すべてと記録の表・
 *    posture-images / meal-images の {userId}/ をページ送りして全部・support_tickets の user_id か device_id が合う行のうち
 *    対応が終わったもの・app_events の device_id が合う行・daily_checkins・coaching・families・family_members・invite・
 *    transfer_codes。2026-10-02 から CASCADE に任せず明示的に消す）。どれか1つでも消せなければ users を消さずに 500 を返す。
 *    RevenueCat の顧客記録（app_user_id = device_id）は、シークレットキー（REVENUECAT_SECRET_API_KEY）があればその場で消し、
 *    消せなかったとき（キーが未設定のときも）は support_tickets に「やること」を残して運営が手で消す（30日以内と書いている）。
 *    端末の中の姿勢チェックの記録（localStorage の kobapro_records）は settings/page.tsx の handleDelete で消す
 *  - 形を変えて残すもの: app_events の今日（日本時間）の checkin_ai_free は、device_id を使い捨ての番号に置きかえて残す
 *    （アプリ全体の1日の上限を数える台帳。消すと上限が効かなくなる）
 *  - 残るデータ: 未対応・対応中の support_tickets（件名の頭に「【アカウント削除済み・対応後に削除】」を付けて user_id を外す。
 *    管理画面 /admin/support で「解決済」にすると api/admin/support の PATCH が行ごと消す。lib/support-ticket-markers.ts）、
 *    アプリの外のブラウザから送った support_tickets（user_id も device_id も合わない）、
 *    問い合わせのときに Resend で送ったメール（api/support の sendEmails。運営あての通知メールと、それに続くメールのやりとり、
 *    Resend 側の送信の記録。Resend の説明では30日間保存）、App Store / Google Play の購入記録、
 *    引継ぎコードで復元したときに新しい端末で先に作られたアカウント（transfer/restore は元のアカウントを消さない）
 *  - 審査用の共用アカウント（reusable の引継ぎコードを持つもの）は、アプリからは削除できない（403）
 *  - 定期購入の解約の手順: 利用規約 第4条・サポートの FAQ「サブスクリプションを解約するには？」と同じ文
 */

import Link from "next/link";
import SmartBackLink from "../components/SmartBackLink";

export const metadata = {
  title: "アカウント削除のご案内 | ZERO-PAIN",
  description:
    "ZERO-PAIN（運営: 有限会社トップバンク）のアカウントとデータを削除する方法、削除されるデータと残るデータ、保存期間のご案内です。",
};

/** アカウントを削除すると消えるデータ（アプリから削除しても、フォームで依頼しても同じ） */
const DELETED_ITEMS: string[] = [
  "ご登録の情報（お名前・お住まいの都道府県・年齢・性別）",
  "体の情報（身長・体重と体重の記録、ふだんの活動量、痛みのある場所、お悩み、選んだお悩みの記録）",
  "姿勢チェックの記録と写真",
  "食事の記録と写真",
  "食事の目標（目標のカロリーや体重など）",
  "ガイコツ先生（AIチャット）とのやりとりと、チャットで送った写真",
  "体調チェック（その日の体調の記録）",
  "30日コーチングの内容と進み具合",
  "家族グループ（作ったグループと、参加の記録）",
  "招待コードと、紹介した・された記録",
  "機種変更のための引継ぎコード",
  "機能ごとの利用回数",
  "アプリの中の有料プランの記録（どのプランか・期限など）",
  "RevenueCat（レベニューキャット）社にある、お支払いの状態を確かめるための記録（アプリが作ったランダムな番号、お使いの機種などの情報、申し込んだプランと期間など）",
  "アプリの中から送ったお問い合わせの記録（まだ対応中のものは、対応が終わってから削除します）",
  "利用の記録（画面を開いた・ボタンを押したといった記録）",
];

/** アカウントを削除しても残るもの */
const KEPT_ITEMS: Array<{ title: string; detail: string; period: string }> = [
  {
    title: "App Store / Google Play の購入の記録",
    detail:
      "有料プランのお申し込みとお支払いの記録は、Apple社・Google社が管理しています。こちらでは削除できません。",
    period: "Apple社・Google社の決まりに従って保存されます。",
  },
  {
    title: "アプリの外から送ったお問い合わせの記録",
    detail:
      "スマートフォンのブラウザやパソコンなど、アプリの外でサポートのページを開いて送っていただいたお問い合わせ（お名前・メールアドレス・内容と、お使いの機種やブラウザの情報）です。アプリのアカウントと結びついていないため、アプリで削除しても消えません。",
    period: "期限は決めていません。ご希望があれば削除します。",
  },
  {
    title: "お問い合わせのときに、当方に届いたメール",
    detail:
      "お問い合わせを受け付けると、当方の担当者あてに、お名前・メールアドレス・カテゴリ・件名・お問い合わせの内容が書かれたお知らせのメールが届きます。そのあとメールでやりとりをした場合は、そのメールも当方のメールボックスに残ります。アプリから送ったお問い合わせでも、アカウントを削除しただけでは、これらのメールは消えません。",
    period: "期限は決めていません。ご希望があれば削除します。",
  },
  {
    title: "メールを送る会社（Resend 社）に残る、送ったメールの記録",
    detail:
      "お問い合わせのときのメール（当方へのお知らせと、お客様への「受け付けました」のお知らせ）は、Resend（リセンド）社のサービスを使って送っています。Resend 社には、送ったメールの内容（お名前・メールアドレス・件名・お問い合わせの内容）が記録されます。",
    period: "Resend 社の説明では、30日間保存されます。",
  },
  {
    title: "機種変更のときに、新しい端末で先に登録したアカウント",
    detail:
      "引継ぎコードで前の端末の記録を移した場合、新しい端末で引継ぎの前に登録したアカウントは、別のアカウントとして残ります。このアカウントはアプリからは削除できません。",
    period: "期限は決めていません。フォームでお知らせいただければ削除します。",
  },
];

export default function DeleteAccountPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <SmartBackLink className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm" />
        <h1 className="text-base font-bold">アカウント削除のご案内</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6 text-sm leading-relaxed text-gray-200">
        <section>
          <p className="text-xs text-gray-400 mb-2">最終更新日: 2026年10月2日</p>
          <p>
            このページでは、セルフケアアプリ「ZERO-PAIN」のアカウントと、そのデータを削除する方法をご案内します。
          </p>
          <ul className="mt-2 space-y-1 pl-4 list-disc text-gray-300">
            <li>
              アプリ名: <strong className="text-white">ZERO-PAIN</strong>
            </li>
            <li>
              運営: <strong className="text-white">有限会社トップバンク（TOPBANK.INC）</strong>
            </li>
          </ul>
        </section>

        {/* 定期購入はアカウントを消しても止まらない。いちばん大事なことなので、手順より先に出す */}
        <section className="card-accent-amber p-4 space-y-2">
          <p className="font-bold text-amber-300">⚠️ 削除の前に、定期購入を解約してください</p>
          <p className="text-gray-200">
            <strong className="text-white">
              アカウントを削除しても、有料プラン（定期購入）は解約されません。お支払いも止まりません。
            </strong>
            有料プランをお使いの方は、先に次の画面から解約してください。アプリを削除（アンインストール）しただけでも、解約にはなりません。
          </p>
          <ul className="space-y-1 pl-4 list-disc text-gray-200">
            <li>
              <strong className="text-white">iPhone</strong>: 「設定」アプリ → いちばん上のご自分の名前 →「サブスクリプション」
            </li>
            <li>
              <strong className="text-white">Android</strong>: Google Play ストア → プロフィール →「お支払いと定期購入」→「定期購入」
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">1. アプリから削除する（いちばん早い方法）</h2>
          <ol className="space-y-1.5 pl-5 list-decimal text-gray-300">
            <li>ZERO-PAIN のアプリを開き、画面のいちばん下の右はしにある「メニュー」を押します。</li>
            <li>「設定」を押します。</li>
            <li>「データ管理」の中にある「アカウントを削除」を押します。</li>
            <li>確認の欄に、半角の大文字で「DELETE」と入力します。</li>
            <li>「完全に削除する」を押します。</li>
          </ol>
          <p className="mt-2 text-gray-300">
            その場ですぐに削除されます。削除したアカウントとデータは、元に戻せません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">2. アプリが手元にない方・アプリを開けない方</h2>
          <p className="mb-2 text-gray-300">
            アプリをすでに削除（アンインストール）した方や、アプリを開けない方は、サポートのお問い合わせフォームから削除をご依頼ください。
          </p>
          <ol className="space-y-1.5 pl-5 list-decimal text-gray-300">
            <li>
              <Link href="/support#contact" className="text-emerald-400 underline">
                サポートのページ
              </Link>
              を開き、下のほうの「お問い合わせフォーム」に進みます。
            </li>
            <li>「お名前」と、お返事を受け取る「メールアドレス」を入れます。</li>
            <li>カテゴリは「アカウント・課金」を選びます。</li>
            <li>
              件名に<strong className="text-white">「アカウント削除の依頼」</strong>と書きます。
            </li>
            <li>
              「お問い合わせ内容」に次の3つを書いて、送ります。
              <ul className="mt-1 space-y-0.5 pl-4 list-disc">
                <li>アプリに登録したお名前</li>
                <li>おおよその登録時期（例: 2026年5月ごろ）</li>
                <li>使っていた機種（例: iPhone 13、Android の Pixel 8）</li>
              </ul>
            </li>
          </ol>
          <p className="mt-2 text-gray-300">
            いただいた内容で、ご本人のアカウントであることを確かめます（確かめるために、メールでおたずねすることがあります）。
            <strong className="text-white">
              本人確認ができたら、30日以内に削除し、削除が終わったことをメールでお知らせします。
            </strong>
          </p>
          <p className="mt-2 text-gray-300">
            下の「4. 削除されずに残るもの」のうち、お問い合わせの記録なども消してほしい場合は、そのこともお書きください（お問い合わせの記録は、削除が終わったことをお知らせしたあとに消します）。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">3. 削除されるデータ</h2>
          <p className="mb-2 text-gray-300">
            アプリから削除したときも、フォームでご依頼いただいたときも、次のデータを削除します。
          </p>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            {DELETED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="mt-2 text-gray-300">
            アプリから削除したときは、その端末の中に保存された姿勢チェックの記録も消えます。
          </p>
          <p className="mt-2 text-gray-300">
            ただし、AI の使いすぎを防ぐための記録（有料プランでない方が体調チェックをしたときに残る記録）のうち、削除した日（日本時間）の分は、アプリ全体の1日の回数を数えるのに使うため、どなたの記録か分からない形（アプリが作った番号を、別のランダムな番号に置きかえた形）にして残します。残るのは日時だけで、お名前・体の情報・写真は含みません。
          </p>
          <p className="mt-2 text-gray-300">
            RevenueCat（レベニューキャット）社は、有料プランのお支払いの状態を確かめる仕事を任せている会社です。アプリから削除したときは、その場で RevenueCat 社に記録の削除を依頼します。その場で削除できなかったときは、当方が30日以内に削除します。
          </p>
          <p className="mt-2 text-gray-300">
            まだ対応中のお問い合わせがあるときは、そのお問い合わせは対応が終わるまで残し、対応が終わってから削除します（返金などのご相談が、途中で消えてしまわないようにするためです）。
          </p>
          <p className="mt-2 text-gray-300">
            家族グループを作った方がアカウントを削除すると、その家族グループもなくなり、ご家族は家族プランを使えなくなります。家族グループに参加している方が削除すると、そのグループから抜けます。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">4. 削除されずに残るもの</h2>
          <p className="mb-2 text-gray-300">
            次のものは、アカウントを削除しても残ります。また、上に書いたとおり、<strong className="text-white">定期購入は解約されません</strong>。
          </p>
          <div className="space-y-2">
            {KEPT_ITEMS.map((item) => (
              <div key={item.title} className="card-base p-3 space-y-1">
                <p className="font-bold text-white">{item.title}</p>
                <p className="text-gray-300">{item.detail}</p>
                <p className="text-gray-300">
                  <span className="font-bold text-amber-300">保存期間:</span> {item.period}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-gray-300">
            法令で保存が義務づけられているために残すデータは、ありません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">5. 保存期間</h2>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>アカウントがある間は、データを保存します。</li>
            <li>アプリでアカウントを削除したときは、その場ですぐに削除します。</li>
            <li>RevenueCat 社の記録は、その場で削除を依頼します。その場で削除できなかったときは、当方が30日以内に削除します。</li>
            <li>まだ対応中のお問い合わせは、対応が終わってから削除します。</li>
            <li>フォームでご依頼いただいたときは、本人確認ができてから30日以内に削除し、メールでお知らせします。</li>
            <li>「4. 削除されずに残るもの」は、それぞれに書いた保存期間のとおりです。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">6. お問い合わせ</h2>
          <p className="text-gray-300">
            このページの内容についてのご質問は、
            <Link href="/support#contact" className="text-emerald-400 underline">
              サポートのお問い合わせフォーム
            </Link>
            からお送りください。データの取り扱いについては、
            <Link href="/privacy" className="text-emerald-400 underline">
              プライバシーポリシー
            </Link>
            もご覧ください。
          </p>
        </section>

        <div className="pt-6 pb-12 text-center">
          <SmartBackLink
            className="inline-block px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm"
            defaultLabel="アプリに戻る"
            lpLabel="LP に戻る"
          />
        </div>
      </div>
    </main>
  );
}
