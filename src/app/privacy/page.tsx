/**
 * プライバシーポリシー（/privacy）
 *
 * 2026-10-02 全面的に見直し、実装と Google Play のデータセーフティの申告（docs/play-data-safety.md）に合わせた。
 *  - 外部の会社（Anthropic・Supabase・Vercel・RevenueCat・Resend）は「業務の委託」として書く。Play の申告は「共有なし」（サービス プロバイダ）。
 *  - OpenAI はどこからも呼んでいないので消した（撮影の音声ガイドは public/voice-*.mp3 を流すだけ）。
 *  - データベースは Supabase の東京リージョン（2026-10-02 にダッシュボードで確認）。サーバーの処理（Vercel の関数）も東京（vercel.json の regions: hnd1）。
 *  - Anthropic に渡すもの: api/chat・checkin・coaching・predict・report・meal・meal/append・meal/reanalyze。
 *    骨格座標（posture_records.landmarks）・都道府県・メール・device_id は渡さない。
 *    写真は、食事の分析（meal・meal/append）では画像そのもの（base64）、チャット（chat）では lib/supabase-storage.ts の
 *    1時間の Signed URL（姿勢写真・チャットで送った写真・24時間以内の最新の食事写真）。
 *  - 家族グループで他のメンバーに渡る情報: api/family の GET（グループ名・家族コード・メンバーの名前/年齢/役割/参加日・
 *    オーナーの契約状態と期限）。画面に出すのは page.tsx の家族グループ画面のとおり。
 *  - 削除されるもの・残るもの: /delete-account（src/app/delete-account/page.tsx）と同じ。実装を変えたら両方を見直す。
 *  - 5.（外国にある第三者への提供。個人情報保護法28条）: 外国かどうかはサーバーの場所ではなく会社で決まるので、5社とも外国の会社として書く。
 *    根拠は5社とも、各社の利用規約に組み込まれた DPA による基準適合体制（28条1項・施行規則16条1号）。そのうえで27条5項1号の
 *    委託として渡す（29条1項ただし書により、提供の記録は要らない）。
 *    Anthropic も同じ（2026-10-02 第2回で変更）。以前は「登録時の同意」を根拠にしていたが、次の理由でやめた:
 *      - 2026-10-02 より前の同意文は「Anthropic, PBC (Claude API) / OpenAI, Inc.」だけで、国名・その国の制度・相手先の措置
 *        （施行規則17条2項の情報）がなかった。同意の欄ができたのは 2026-05-18 のコミット 29a6ad9 からで、それより前の版で登録した人は同意自体をしていない。
 *      - 同意をサーバーに保存していない（page.tsx の agreedAI は /api/register に送らない）。
 *      - 同意を根拠にすると27条5項（委託）の例外が使えず、29条の記録（施行規則19-21条）が要る。
 *    登録時の同意（page.tsx の同意の欄）は、App Store の審査（5.1.1(i)・5.1.2(i)）のために「あわせて」いただいているものとして書く。
 *    根拠を同意に戻すなら、既存の利用者に新しい同意文で同意し直してもらい、同意の日時と版の保存・29条の記録を作り、
 *    8. と /delete-account の「法令で保存が義務づけられているために残す情報は、ありません」も直すこと。
 *    2026-10-02 に各社の公開文書で確認:
 *      Anthropic: Commercial Terms「DPA is incorporated into these Terms by reference」「may not train models on Customer Content」、
 *                 API の入力と出力は原則30日以内に削除（privacy.claude.com の保存期間の説明。違反の疑いなどは例外）
 *      Supabase: 契約の相手は Supabase Pte. Ltd.（シンガポール。supabase.com/terms）。DPA は利用規約の一部（supabase.com/legal/dpa）
 *      Vercel: DPA は Pro・Enterprise のお客さまに適用（vercel.com/legal/dpa）。当方のチームは Pro（vercel api /v2/teams で確認）
 *      RevenueCat: DPA は利用規約などの一部（revenuecat.com/dpa）
 *      Resend: 契約の相手は Plus Five Five, Inc.（アメリカ）。DPA は利用規約の締結で効力を持つ（resend.com/legal/dpa）。
 *              メールのデータの保存は30日（resend.com/docs の account quotas and limits）
 *    28条3項（基準適合体制のときは、措置の内容をご本人の求めに応じて知らせる）も 5. に書いている。
 *    28条3項・施行規則18条1項により、各社の措置が続いているか（と、その国の制度で妨げがないか）を定期的に確かめ、
 *    妨げがあれば対応する必要がある（確かめた日と内容を残しておくと、求めに応じて知らせるときに使える）。
 */

import Link from "next/link";
import SmartBackLink from "../components/SmartBackLink";

export const metadata = {
  title: "プライバシーポリシー | ZERO-PAIN",
  description:
    "セルフケアアプリ ZERO-PAIN（運営: 有限会社トップバンク）で、お預かりする情報と、その扱い方についてのご説明です。",
};

/** 2. お預かりする情報 */
const COLLECTED_ITEMS: Array<{ title: string; detail: string }> = [
  {
    title: "ご登録の情報",
    detail:
      "お名前（ニックネームでもかまいません。必須）。お住まいの都道府県・年齢・痛みのある場所・お悩み（どれも任意）。",
  },
  {
    title: "体と目標の情報",
    detail:
      "性別、身長、体重と体重の記録、ふだんの活動量、食事の目標（目的・目標のカロリーや栄養の量・目標の体重・期間）。",
  },
  {
    title: "姿勢チェック",
    detail:
      "保存した姿勢の写真（体の線を重ねたもの）、体の各部の位置を示す点の座標（骨格座標）、チェックの結果。カメラの映像は端末の中で使うだけで、送りません。",
  },
  {
    title: "食事の記録",
    detail:
      "食事の写真、AI が見立てたメニュー名・カロリー・栄養・点数・アドバイス、朝食・昼食などの区分、ご自分で直した内容。",
  },
  {
    title: "ガイコツ先生（AIチャット）",
    detail: "やりとりの文章（あなたが書いた文と、先生の返事）と、チャットで送った写真。",
  },
  {
    title: "体調チェック",
    detail: "その日の体調（5段階）、ひとこと（60文字まで）、先生からのひとこと。",
  },
  {
    title: "30日コーチング",
    detail: "選んだ目標とゴールの文（100文字まで）、毎日の課題と、終えた日時。",
  },
  {
    title: "家族グループと招待",
    detail:
      "家族グループの名前・家族コード・メンバー・オーナーかどうか・参加した日。招待コードと、だれがだれを招待したかの記録。招待コードの頭には、お名前に英字が入っていれば、その英字（4文字まで）が使われます。",
  },
  {
    title: "利用の記録",
    detail:
      "選んだお悩み（症状）の記録、機能ごとの利用回数。アプリの使われ方の記録（登録画面を開いた・登録を終えた・料金プランの案内や画面を見た・購入ボタンを押した、という記録と日時。見た機能の名前や選んだプランも含みます。登録の前から記録します）。AI の使いすぎを防ぐための記録（有料プランでない方に、体調チェックで先生のひとことを作った記録）。",
  },
  {
    title: "有料プランの情報",
    detail:
      "状態（無料・無料体験中・月額・年額・解約済み・期限切れ）、プランの種類（家族プランかどうか）、期間と無料体験の期限、RevenueCat で使う番号（端末IDと同じもの）。カード番号などのお支払いの情報は、お預かりしません。",
  },
  {
    title: "お問い合わせ",
    detail:
      "フォームに入力したお名前・メールアドレス・カテゴリ・件名・内容、お使いの機種やブラウザの情報（ユーザーエージェント）、端末ID（ご登録済みの方は、アカウントと結び付けます）、当方からのお返事。",
  },
  {
    title: "端末IDと引継ぎコード",
    detail:
      "アプリがはじめに作るランダムな番号（端末ID）。機種変更のための引継ぎコード（1時間で使えなくなります）。",
  },
];

/** 2. お預かりしないもの */
const NOT_COLLECTED_ITEMS: string[] = [
  "端末の位置情報（GPS など）。写真は端末の中で作り直してから送るため、撮った場所の情報は付きません。",
  "マイクの音声。撮影のときの音声ガイドは、あらかじめ用意した音声を流すだけです。",
  "連絡先、広告ID、プッシュ通知のための番号（通知は、端末の中で予約するだけです）。",
  "iPhone の「ヘルスケア」App のデータ（連携は準備中で、当方のサーバーへ送ることはありません）。",
];

/** 4. 業務の委託先 */
const PROCESSORS: Array<{
  name: string;
  country: string;
  role: string;
  data: string[];
  note?: string;
  policyUrl: string;
}> = [
  {
    name: "Anthropic, PBC（Claude API）",
    country: "アメリカ合衆国",
    role: "AI（Claude）による、ガイコツ先生の返事、食事の写真の分析、体調チェックの先生のひとこと、痛み予測、振り返りレポート、30日コーチングの作成。",
    data: [
      "あなたが書いた文章（チャットの文、体調チェックのひとこと、コーチングのゴールの文、ご自分で直した食事のメニュー名）と、これまでの相談の書き出し（40文字まで）",
      "お名前、年齢、性別、身長、体重、ふだんの活動量",
      "痛みのある場所、お悩み、選んだお悩みの記録、姿勢チェックの結果、体調チェックの記録、体重の推移",
      "食事の記録と食事の目標",
      "写真: 食事の分析では、食事の写真そのものを送ります。ガイコツ先生への相談では、姿勢の写真・チャットで送った写真・直近の食事の写真を、写真そのものではなく、1時間だけ使える専用のURL（署名付きURL）で渡し、Anthropic がそのURLから写真を読み込みます。",
    ],
    note: "骨格座標、お住まいの都道府県、メールアドレス、端末IDは渡しません。送ったデータが AI の学習に使われることはありません（Anthropic の取り決めによります）。はじめて登録するときに、Anthropic へデータを送ることについて同意をいただきます。同意いただけない場合は、登録できません。",
    policyUrl: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Supabase Pte. Ltd.",
    country: "会社はシンガポール。データの保存場所は日本（東京）",
    role: "データベースと、写真の保管。",
    data: [
      "上の「2. お預かりする情報」に書いた情報（写真を含みます）",
    ],
    note: "写真の保管場所は公開していません。",
    policyUrl: "https://supabase.com/privacy",
  },
  {
    name: "Vercel Inc.",
    country: "会社はアメリカ合衆国。サーバーの処理は日本（東京）",
    role: "アプリの画面の配信と、サーバーの処理。",
    data: ["アプリと当方のサーバーの間でやりとりする情報（すべて Vercel を通ります）"],
    policyUrl: "https://vercel.com/legal/privacy-notice",
  },
  {
    name: "RevenueCat, Inc.",
    country: "アメリカ合衆国（RevenueCat 社によると、データはアメリカのデータセンターに保存されます）",
    role: "有料プランの購入の確認と管理。",
    data: [
      "端末ID（RevenueCat の中で、あなたを見分ける番号として使います）",
      "購入の情報（商品・価格・通貨・ストアの購入の記録）",
      "RevenueCat の仕組みが自動で送る端末の情報（機種名・OS のバージョン・言語の設定など）",
    ],
    note: "スマートフォンのアプリで料金プランの画面を開いたときや、購入・購入の復元をしたときに、アプリから RevenueCat へ直接送られます。お名前・メールアドレス・体の情報・写真は渡しません。アカウントを削除すると、RevenueCat 社の記録も削除します（「8.」を参照）。",
    policyUrl: "https://www.revenuecat.com/privacy",
  },
  {
    name: "Resend（運営: Plus Five Five, Inc.）",
    country: "アメリカ合衆国",
    role: "お問い合わせを受けたときのメールの送信（当方へのお知らせと、お客様への受け付けのお知らせ）。",
    data: ["お問い合わせのお名前・メールアドレス・カテゴリ・件名・内容"],
    policyUrl: "https://resend.com/legal/privacy-policy",
  },
];

const linkClass = "text-emerald-400 underline";
const extLinkClass = "text-blue-400 underline";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 flex items-center gap-3">
        <SmartBackLink className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-sm" />
        <h1 className="text-base font-bold">プライバシーポリシー</h1>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-6 space-y-6 text-sm leading-relaxed text-gray-200">
        <section>
          <p className="text-xs text-gray-400 mb-2">最終更新日: 2026年10月2日</p>
          <p>
            ZERO-PAIN（以下「本アプリ」といいます）は、有限会社トップバンク（TOPBANK.INC、以下「当方」といいます）が運営する、セルフケアのためのアプリです。
            このプライバシーポリシーでは、本アプリで当方がお預かりする情報と、その扱い方をご説明します。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">1. 事業者の情報</h2>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>事業者名: 有限会社トップバンク（TOPBANK.INC）</li>
            <li>アプリ名: ZERO-PAIN</li>
            <li>
              お問い合わせ窓口:{" "}
              <Link href="/support#contact" className={linkClass}>
                サポートのお問い合わせフォーム
              </Link>
            </li>
            <li>住所・代表者の氏名: お問い合わせいただければ、お知らせします。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">2. お預かりする情報</h2>
          <p className="mb-2">本アプリでは、次の情報をお預かりします。</p>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            {COLLECTED_ITEMS.map((item) => (
              <li key={item.title}>
                <strong className="text-white">{item.title}</strong>: {item.detail}
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-2">次のものは、お預かりしません。</p>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            {NOT_COLLECTED_ITEMS.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">3. 使う目的</h2>
          <p className="mb-2">お預かりした情報は、次の目的で使います。</p>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>姿勢チェック・食事の記録と分析・ガイコツ先生への相談・体調チェック・痛み予測・振り返りレポート・30日コーチングなど、本アプリの機能をお届けするため</li>
            <li>お一人おひとりに合わせたセルフケアのご提案や、お名前での呼びかけのため</li>
            <li>家族プラン・家族グループ・招待の機能のため</li>
            <li>有料プランの購入の確認と、使える機能の判定のため</li>
            <li>機種変更のときの引継ぎのため</li>
            <li>お問い合わせへのお返事と、必要なご連絡のため</li>
            <li>
              利用状況の分析と、本アプリをよりよくするため（当方の担当者が、管理用の画面で、ご登録の情報や記録（チャットの内容を含みます）を確認・集計することがあります）
            </li>
            <li>AI の使いすぎや、不正な使い方を防ぐため</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">4. 業務の委託（外部の会社に任せている仕事）</h2>
          <p className="mb-2">
            当方は、本アプリを動かすために、次の会社に情報の取り扱いの一部を任せています（業務の委託）。
            各社は、当方の依頼にもとづいて情報を扱います。各社での扱い方は、それぞれのプライバシーポリシーでご確認いただけます。
          </p>
          <div className="space-y-2">
            {PROCESSORS.map((p) => (
              <div key={p.name} className="card-base p-3 space-y-1.5 text-gray-300">
                <p className="font-bold text-white">{p.name}</p>
                <p>
                  <span className="font-bold text-amber-300">所在国:</span> {p.country}
                </p>
                <p>
                  <span className="font-bold text-amber-300">任せている仕事:</span> {p.role}
                </p>
                <div>
                  <span className="font-bold text-amber-300">渡す情報:</span>
                  <ul className="mt-0.5 space-y-0.5 pl-4 list-disc">
                    {p.data.map((d) => (
                      <li key={d}>{d}</li>
                    ))}
                  </ul>
                </div>
                {p.note && <p>{p.note}</p>}
                <p>
                  <a href={p.policyUrl} target="_blank" rel="noopener noreferrer" className={extLinkClass}>
                    {p.name.split("（")[0]} のプライバシーポリシー
                  </a>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">5. 外国にある会社に情報を渡すこと</h2>
          <p className="mb-2 text-gray-300">
            「4.」の5社は、どれも外国にある会社です。Supabase 社と Vercel 社では、本アプリの情報を日本（東京）で保存・処理していますが、会社が外国にあるため、ほかの会社と同じように扱います。
            外国にある会社に情報を渡すときは、個人情報保護法にもとづき、次のとおり扱っています。
          </p>
          <div className="space-y-2">
            <div className="card-base p-3 space-y-1.5 text-gray-300">
              <p className="font-bold text-white">
                Anthropic, PBC（アメリカ合衆国）、RevenueCat, Inc.（アメリカ合衆国）、Resend（Plus Five Five, Inc.、アメリカ合衆国）、Vercel Inc.（アメリカ合衆国）、Supabase Pte. Ltd.（シンガポール）
              </p>
              <p>
                <span className="font-bold text-amber-300">渡すときの根拠:</span>{" "}
                当方は、各社と結んでいる契約（各社の利用規約に含まれる、データの取り扱いについての取り決め＝データ処理契約）により、各社に、個人情報保護法が求める水準の措置を取らせています（法律でいう「基準適合体制」）。
                そのうえで、「4.」のとおり、当方の仕事を任せる形（業務の委託）で、情報を渡しています。5社とも同じです。
              </p>
              <p>
                その措置の内容（各社が取っている措置のあらまし、当方がそれを確かめる方法など）は、お問い合わせいただければ、お知らせします。
              </p>
            </div>
            <div className="card-base p-3 space-y-1.5 text-gray-300">
              <p className="font-bold text-white">Anthropic, PBC について（くわしく）</p>
              <p>
                <span className="font-bold text-amber-300">Anthropic が取っている措置:</span>{" "}
                Anthropic の商用の利用規約では、送ったデータを AI の学習に使わないこと、データの取り扱いについての取り決め（データ処理契約）に従って扱うことが定められています。
                また、Anthropic は、受け取った内容とその返事を、原則として30日以内に削除するとしています（Anthropic の利用のルールに反する疑いがある場合や、法令で求められる場合などは、より長く保存されることがあります）。
              </p>
              <p>
                <span className="font-bold text-amber-300">登録のときの同意:</span>{" "}
                今の登録の画面では、上の根拠とは別に、AI の機能のために外部の AI サービス（Anthropic）へ情報を送ることへの同意も、あわせていただいています（「外部の AI サービスへ送ることに同意します」の欄）。
              </p>
            </div>
          </div>
          <p className="mt-3 mb-1 text-gray-300">それぞれの国の、個人情報を守るための制度は、次のとおりです。</p>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>
              アメリカ合衆国: 国全体に当てはまる個人情報の保護のための包括的な法律はなく、分野ごとの法律や、州ごとの法律で守られています（
              <a
                href="https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_america/"
                target="_blank"
                rel="noopener noreferrer"
                className={extLinkClass}
              >
                個人情報保護委員会「外国制度（アメリカ合衆国）」
              </a>
              ）。
            </li>
            <li>
              シンガポール: 民間の事業者を対象とする、個人情報の保護のための包括的な法律（個人情報保護法、Personal Data Protection Act 2012）があります（
              <a
                href="https://www.ppc.go.jp/enforcement/infoprovision/laws/offshore_report_singapore/"
                target="_blank"
                rel="noopener noreferrer"
                className={extLinkClass}
              >
                個人情報保護委員会「外国制度（シンガポール共和国）」
              </a>
              ）。
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">6. ほかの方に伝わる情報（家族グループ・招待・シェア）</h2>
          <p className="mb-2 text-gray-300">
            家族グループを作るか、家族コードで参加すると、同じグループのメンバーのアプリに、次の情報が送られます。
          </p>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>グループの名前と家族コード</li>
            <li>メンバーのお名前・年齢・オーナーかどうか・参加した日（と、アプリの中でメンバーを見分ける番号）</li>
            <li>オーナーの有料プランの状態（無料・無料体験中・月額・年額など）と、その期限</li>
          </ul>
          <p className="mt-2 text-gray-300">
            画面に表示されるのは、グループの名前、メンバーのお名前・年齢・オーナーかどうか、オーナーのプランの種類です（家族コードは、オーナーの画面にだけ表示されます）。
            体の情報、姿勢や食事の記録、写真、チャット、体調チェックなどは、家族には伝わりません。
          </p>
          <p className="mt-2 text-gray-300">
            招待コードを使って登録した方がいると、招待した方には、その人数だけが伝わります。お名前は伝わりません。
          </p>
          <p className="mt-2 text-gray-300">
            シェアのボタンを押したときは、ご自分で選んだアプリ（LINE など）へ、文章が送られます。
            文章には、バッジの名前と続けた日数、姿勢のスコアの変化、招待コードや家族コードなどが入ることがあります。
            送り先はご自分で選ぶもので、当方がその内容を受け取ることはありません。
          </p>
          <p className="mt-2 text-gray-300">
            このほか、法令にもとづく場合など個人情報保護法で認められた場合を除き、ご本人の同意なく、お預かりした情報をほかの会社や人にお渡しすることはありません。
            お預かりした情報を売ることもありません。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">7. 有料プランとお支払い</h2>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>
              有料プランのお支払いは、iPhone では App Store（Apple 社）、Android では Google Play（Google 社）の決済の仕組みで行われます。
            </li>
            <li>
              カード番号などのお支払いの情報は Apple 社・Google 社が扱い、当方には届きません。当方が保存するのは、「2.」の「有料プランの情報」だけです。
            </li>
            <li>
              解約は、iPhone は「設定」アプリ → いちばん上のご自分の名前 →「サブスクリプション」、Android は Google Play ストア → プロフィール →「お支払いと定期購入」→「定期購入」から行えます。アプリを削除しただけでは、解約になりません。返金の扱いは、
              <Link href="/terms" className={linkClass}>
                利用規約
              </Link>
              の第4条をご覧ください。
            </li>
            <li>家族プランでは、オーナーの有料プランの状態が、家族グループのメンバーに伝わります（「6.」を参照）。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">8. 保存する場所と期間</h2>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>当方のサーバーにお預かりする情報は、日本（東京）にある Supabase のデータベースと、写真の保管場所に保存します。</li>
            <li>姿勢チェックの記録（写真を含みます）は、お使いの端末の中にも保存します（メニューの「履歴」に出るもの）。</li>
            <li>アカウントがある間は、保存します。</li>
            <li>アプリでアカウントを削除すると、その場ですぐに削除します。</li>
            <li>
              RevenueCat 社にある記録は、アプリでアカウントを削除すると、その場で RevenueCat 社に削除を依頼します。その場で削除できなかったときは、当方が30日以内に削除します。
            </li>
            <li>まだ対応中のお問い合わせは、アカウントを削除しても対応が終わるまで残し、対応が終わってから削除します。</li>
            <li>お問い合わせフォームで削除をご依頼いただいたときは、ご本人であることを確かめてから30日以内に削除し、メールでお知らせします。</li>
            <li>
              次のものは、アカウントを削除しても残ります。期限は決めていませんが、ご希望があれば削除します: アプリの外（ブラウザなど）から送ったお問い合わせの記録、お問い合わせのときに当方に届いたお知らせのメールと、そのあとのメールでのやりとり（お名前・メールアドレス・お問い合わせの内容）、機種変更のときに新しい端末で先に登録したアカウント。
            </li>
            <li>
              お問い合わせのときのメールは Resend 社のサービスで送っており、Resend 社にも送ったメールの記録が残ります。Resend 社の説明では、30日間保存されます。
            </li>
            <li>
              AI の使いすぎを防ぐための記録のうち、アカウントを削除した日（日本時間）の分は、アプリ全体の1日の回数を数えるのに使うため、どなたの記録か分からない形にして残します。
            </li>
            <li>App Store・Google Play の購入の記録は、Apple 社・Google 社が管理し、各社の決まりに従って保存されます。当方では削除できません。</li>
            <li>法令で保存が義務づけられているために残す情報は、ありません。</li>
          </ul>
          <p className="mt-2 text-gray-300">
            削除される情報と残る情報のくわしい一覧は、
            <Link href="/delete-account" className={linkClass}>
              アカウント削除のご案内
            </Link>
            をご覧ください。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">9. アカウントの削除</h2>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>
              アプリから: 画面のいちばん下の右はしにある「メニュー」→「設定」→「データ管理」の「アカウントを削除」を押し、半角の大文字で「DELETE」と入力して「完全に削除する」を押します。
            </li>
            <li>
              アプリが手元にない方・アプリを開けない方は、
              <Link href="/delete-account" className={linkClass}>
                アカウント削除のご案内
              </Link>
              の方法で、お問い合わせフォームからご依頼ください。
            </li>
            <li>
              <strong className="text-white">アカウントを削除しても、有料プラン（定期購入）は解約されません。</strong>
              先に「7.」の方法で解約してください。
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">10. ご本人からのご請求（開示・訂正・削除など）</h2>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>ご自分の記録は、アプリの画面でご覧いただけます。</li>
            <li>年齢・性別・身長・体重・食事の目標などは、アプリの画面で直せます。お名前など、アプリで直せないものは、お問い合わせフォームからご依頼ください。</li>
            <li>
              お預かりしている情報の開示（どんな情報があるかのお知らせ）、訂正、利用の停止、削除（チャットや食事の記録の一部だけを消すことも含みます）をご希望の方は、お問い合わせフォームからご依頼ください。ご本人であることを確かめたうえで、対応します。
            </li>
            <li>アプリからは、記録をファイルに保存することはできません。記録の写しをご希望の方も、お問い合わせフォームからご依頼ください。</li>
            <li>情報の扱いについてのご意見や苦情も、お問い合わせフォームで受け付けます。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">11. 安全のための取り組み</h2>
          <ul className="space-y-1 pl-4 list-disc text-gray-300">
            <li>通信は、すべて HTTPS（TLS）で暗号化しています。</li>
            <li>データベースと写真は、暗号化した状態で保存しています。</li>
            <li>写真の保管場所は公開しておらず、AI に渡すときは、1時間で使えなくなる専用のURLを使います。</li>
            <li>AI などのサービスを使うための秘密の鍵（APIキー）は、サーバーだけに置き、アプリの中には入れていません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">12. 端末の中に保存する情報（端末IDなど）</h2>
          <ul className="space-y-1.5 pl-4 list-disc text-gray-300">
            <li>本アプリは、はじめて開いたときに、ランダムな番号（端末ID）を作り、端末の中に保存します。</li>
            <li>
              端末IDは、ご登録のお名前などと一緒に当方のサーバーに保存し、あなたのアカウントを見分けるために使います。有料プランの管理（RevenueCat）、お問い合わせ、利用の記録にも使います。
            </li>
            <li>端末の中には、ほかに、姿勢チェックの記録（写真を含みます）や、文字の大きさ・通知の時刻などの設定を保存します。</li>
            <li>広告IDは使いません。ほかの会社のアプリやウェブサイトをまたいで、あなたを追跡すること（トラッキング）もしません。</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">13. 健康情報に関する重要なお知らせ</h2>
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
          <h2 className="text-base font-bold text-white mb-2">14. 未成年者の利用</h2>
          <p className="text-gray-300">
            本アプリは13歳以上の方のご利用を推奨しております。
            未成年の方がご利用になる場合は、保護者の方の同意を得たうえでご利用ください。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">15. このプライバシーポリシーの変更</h2>
          <p className="text-gray-300">
            このプライバシーポリシーは、法令の変更や本アプリの変更に合わせて、改めることがあります。
            大切な変更があるときは、アプリの中やこのページでお知らせします。
          </p>
        </section>

        <section>
          <h2 className="text-base font-bold text-white mb-2">16. お問い合わせ</h2>
          <p className="text-gray-300">
            このプライバシーポリシーや、情報の扱いについてのご質問は、
            <Link href="/support#contact" className={linkClass}>
              サポートのお問い合わせフォーム
            </Link>
            からお送りください。
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
