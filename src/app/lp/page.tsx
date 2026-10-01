import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Faq from './Faq';
import PhoneDemo from './PhoneDemo';
import AnimateOnScroll from './AnimateOnScroll';
import HeaderGetButton from './HeaderGetButton';
import {
  LaptopIcon,
  MoonIcon,
  PhoneIcon,
  BoltIcon,
  PillIcon,
  BuildingIcon,
  BookIcon,
  LockIcon,
  HeartPulseIcon,
  SparklesIcon,
  AppleIcon,
  GooglePlayIcon,
} from './icons';

// 2026-10-01: 「痛みゼロへ」「iPhone アプリ」をやめ、セルフケア支援の言い方と iPhone・Android 対応に揃えた
export const metadata: Metadata = {
  title: 'ZERO-PAIN | AI姿勢分析で、毎日のセルフケアを一緒に',
  description:
    'AI姿勢分析・AI食事分析・ガイコツ先生のカウンセリング・30日コーチング。あなた専用のAIパーソナルトレーナーが、肩こり・腰痛・姿勢が気になる方の毎日のセルフケアをサポートします。iPhone・Android 対応。ダウンロード無料・はじめての方は7日間の無料体験つき。',
  keywords: [
    'ZERO-PAIN',
    'ゼロペイン',
    '姿勢分析',
    'AI姿勢',
    '肩こり',
    '腰痛',
    'セルフケア',
    'AIヘルスケア',
    '骨格',
    'ストレッチ',
    'iPhoneアプリ',
    'Androidアプリ',
  ],
  alternates: {
    canonical: 'https://posture-app-steel.vercel.app/lp',
  },
  openGraph: {
    title: 'ZERO-PAIN | AI姿勢分析で、毎日のセルフケアを一緒に',
    description:
      'あなた専用のAIパーソナルトレーナー。姿勢チェック・ストレッチ・ガイコツ先生への相談で、毎日のセルフケアをサポート。ダウンロード無料・はじめての方は7日間の無料体験つき。',
    url: 'https://posture-app-steel.vercel.app/lp',
    siteName: 'ZERO-PAIN',
    images: [
      {
        url: 'https://posture-app-steel.vercel.app/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'ZERO-PAIN',
      },
    ],
    type: 'website',
    locale: 'ja_JP',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ZERO-PAIN | AI姿勢分析で、毎日のセルフケアを一緒に',
    description:
      'あなた専用のAIパーソナルトレーナー。iPhone・Android 対応。はじめての方は7日間の無料体験つき。',
    images: ['https://posture-app-steel.vercel.app/og-image.jpg'],
  },
};

const APP_STORE_URL = 'https://apps.apple.com/jp/app/zero-pain/id6768903915';
// 2026-10-01: Android でも公開中なので Google Play を追加（アプリ本体 page.tsx の GOOGLE_PLAY_URL と同じ）
const GOOGLE_PLAY_URL = 'https://play.google.com/store/apps/details?id=com.topbank.zeropain';
const LP_URL = 'https://posture-app-steel.vercel.app/lp';

// JSON-LD: SoftwareApplication
// 2026-10-01: 価格を現行の月額880円に。OS に Android を追加。
// 画面に出していない評価（aggregateRating 5.0／1件）は外した（検索向けデータの評価は、ページ上にも見えている必要があるため）。
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ZERO-PAIN',
  operatingSystem: 'iOS, Android',
  applicationCategory: 'HealthApplication',
  description:
    'AI姿勢分析・食事分析・カウンセリング・30日コーチングを備えたセルフケアアプリ',
  offers: {
    '@type': 'Offer',
    price: '880',
    priceCurrency: 'JPY',
  },
  url: LP_URL,
  downloadUrl: [APP_STORE_URL, GOOGLE_PLAY_URL],
};

type StoreKind = 'app-store' | 'google-play';

/**
 * ストアの入手ボタン（2026-10-01: App Store だけだったのを、Google Play と2つ並びにした）
 * - size 'lg': 2行表示（上に「iPhone をお使いの方」などの小さい案内、下にストア名）。ページ本文用
 * - size 'md': 1行表示（ストア名だけ）。sm 以上のヘッダー用
 * - tone 'light': 緑の背景の上に置く白いボタン（最後の案内）
 */
function StoreButton({
  store,
  size = 'lg',
  tone = 'dark',
}: {
  store: StoreKind;
  size?: 'lg' | 'md';
  tone?: 'dark' | 'light';
}) {
  const isApple = store === 'app-store';
  const href = isApple ? APP_STORE_URL : GOOGLE_PLAY_URL;
  const Icon = isApple ? AppleIcon : GooglePlayIcon;
  const storeName = isApple ? 'App Store' : 'Google Play';
  const who = isApple ? 'iPhone をお使いの方' : 'Android をお使いの方';
  const colors =
    tone === 'light'
      ? { background: '#ffffff', color: '#047857' }
      : { background: '#0f172a', color: '#ffffff' };
  const base =
    'inline-flex items-center justify-center rounded-full font-semibold hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98] whitespace-nowrap';
  const shadow = tone === 'light' ? 'shadow-2xl' : 'shadow-lg shadow-slate-900/20';

  if (size === 'md') {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${storeName} で入手`}
        className={`${base} ${shadow} gap-2 px-4 py-2.5 text-sm`}
        style={colors}
      >
        <Icon className="w-5 h-5" style={{ color: colors.color }} />
        <span style={{ color: colors.color }}>{storeName}</span>
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`${base} ${shadow} w-full max-w-[280px] sm:w-auto sm:max-w-none sm:min-w-[230px] gap-3 px-6 py-3`}
      style={colors}
    >
      <Icon className="w-7 h-7 flex-shrink-0" style={{ color: colors.color }} />
      <span className="flex flex-col items-start leading-tight text-left">
        <span className="text-xs font-medium" style={{ color: colors.color, opacity: 0.85 }}>
          {who}
        </span>
        <span className="text-base sm:text-lg font-bold" style={{ color: colors.color }}>
          {storeName} で入手
        </span>
      </span>
    </a>
  );
}

/** App Store と Google Play を並べる（スマホは縦、sm 以上は横） */
function StoreButtons({
  tone = 'dark',
  className = '',
  id,
}: {
  tone?: 'dark' | 'light';
  className?: string;
  id?: string;
}) {
  return (
    <div
      id={id}
      className={`flex flex-col sm:flex-row items-center justify-center gap-3 ${className}`}
    >
      <StoreButton store="app-store" tone={tone} />
      <StoreButton store="google-play" tone={tone} />
    </div>
  );
}

export default function LPPage() {
  return (
    // overflow-x-clip: スクロール前のアニメーション（translate-x-8）がスマホで右にはみ出し、画面が左右にずれるのを止める。
    // overflow-x-hidden にすると main がスクロールする箱になり、上部ヘッダー（sticky）が固定されなくなるので使わない。
    <main className="min-h-screen overflow-x-clip bg-gradient-to-b from-emerald-50 via-white to-emerald-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ===== Sticky Header ===== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-shrink-0 min-w-0">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 p-1 shadow-md overflow-hidden flex-shrink-0">
              <Image
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 whitespace-nowrap">
              ZERO-PAIN
            </span>
          </div>
          {/* モバイル: 「入手」のコンパクトボタン。端末を見分けて App Store / Google Play の合う方を開く */}
          <HeaderGetButton appStoreUrl={APP_STORE_URL} googlePlayUrl={GOOGLE_PLAY_URL} />
          {/* sm 以上: App Store / Google Play の2つ並び */}
          <div className="hidden sm:flex items-center gap-2">
            <StoreButton store="app-store" size="md" />
            <StoreButton store="google-play" size="md" />
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 -left-20 w-72 h-72 bg-emerald-200 rounded-full blur-3xl opacity-40" />
          <div className="absolute top-40 -right-20 w-96 h-96 bg-indigo-200 rounded-full blur-3xl opacity-30" />
        </div>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 sm:pt-20 sm:pb-24 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
          <div className="space-y-6 text-center lg:text-left">
            {/* 2026-10-01: 「App Store 配信開始」→ Android の方も自分の端末で使えると分かるように */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs sm:text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              iPhone・Android 対応
            </div>
            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              痛みのある毎日に、
              <br />
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                AIパーソナル
              </span>
              <br className="sm:hidden" />
              トレーナーを。
            </h1>
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              AI が全身写真から姿勢を分析し、
              <br className="hidden sm:inline" />
              あなた専用のセルフケアを提案。
              <br />
              肩こり・腰痛・姿勢の悩みに、<strong className="inline-block text-slate-900">毎日のセルフケア</strong>で向き合えます。
            </p>
            {/* 2026-10-01: 院の患者さん向けの安心材料。地名・院名は書かない */}
            <p className="text-sm sm:text-base text-emerald-800 font-semibold">
              治療院の先生が、患者さんの毎日のセルフケアのために作ったアプリです。
            </p>
            <div className="space-y-3">
              <StoreButtons id="download" className="scroll-mt-24 lg:justify-start" />
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                はじめての方は7日間無料。無料体験が終わる24時間前までに解約すれば料金はかかりません（解約しない場合は自動で有料プランに切り替わります）。
              </p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2 text-xs sm:text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                医学的根拠に基づく出典
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                ダウンロード無料・7日間の無料体験つき
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                家族プラン対応
              </span>
            </div>
          </div>
          {/* w-full: 幅を決めないと、mx-auto のグリッド要素は中身（画像は absolute で幅を持たない）に合わせて縮み、
              スマホ・タブレットでデモ画面が 24×24px に潰れていた */}
          <div className="relative mx-auto lg:mx-0 w-full max-w-[280px] sm:max-w-sm mt-8 lg:mt-0">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-300 to-indigo-300 rounded-[3rem] blur-2xl opacity-40 scale-105 animate-pulse" />
            <div className="relative lp-float-slow">
              <PhoneDemo />
            </div>
            {/* ガイコツ先生キャラ - lg 以上のみ: iPhone モックの右下に重ねる */}
            <div className="hidden lg:block absolute -bottom-6 -right-10 w-52 z-10 pointer-events-none lp-float">
              <div className="relative w-full aspect-square drop-shadow-2xl">
                <Image
                  src="/icon-skeleton-sensei.png"
                  alt="ガイコツ先生"
                  fill
                  sizes="208px"
                  className="object-contain"
                  priority
                />
              </div>
              <div className="absolute -top-6 -left-8 bg-white rounded-2xl px-3 py-2 shadow-lg border border-emerald-100 text-sm font-bold text-emerald-700 whitespace-nowrap">
                先生にお任せ！
                <span className="absolute -bottom-2 right-6 w-3 h-3 bg-white border-r border-b border-emerald-100 transform rotate-45" />
              </div>
            </div>
          </div>
          {/* モバイル / タブレット用: iPhone の下に独立して横並び配置 */}
          <div className="lg:hidden flex items-center justify-center gap-4 mt-16 pointer-events-none">
            <div className="relative w-28 sm:w-32 flex-shrink-0 lp-float">
              <div className="relative w-full aspect-square drop-shadow-2xl">
                <Image
                  src="/icon-skeleton-sensei.png"
                  alt="ガイコツ先生"
                  fill
                  sizes="128px"
                  className="object-contain"
                />
              </div>
            </div>
            <div className="relative bg-white rounded-2xl px-4 py-3 shadow-lg border border-emerald-100 text-sm font-bold text-emerald-700">
              先生にお任せ！
              <span className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border-l border-b border-emerald-100 transform rotate-45" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pain Points (共感) ===== */}
      <section className="bg-white py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <AnimateOnScroll animation="fade-up">
            <div className="text-center mb-12">
              <p className="text-emerald-600 font-bold text-sm sm:text-base mb-2">
                こんな悩み、ありませんか？
              </p>
              <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
                {/* 2026-10-01: 「…痛み」卒業しませんか → 痛みが無くなると読めないように、毎日のケアの話にした。
                    スマホで「痛／み」と途中で折り返さないよう、意味の切れ目ごとに inline-block にする */}
                <span className="inline-block">「もう何年も</span>
                <span className="inline-block">付き合っている痛み」に、</span>
                <span className="inline-block">毎日のケアを。</span>
              </h2>
            </div>
          </AnimateOnScroll>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { Icon: LaptopIcon, text: 'デスクワークで肩がガチガチ。マッサージに行ってもすぐ戻る' },
              { Icon: MoonIcon, text: '朝起きると腰が重い。何が原因か分からない' },
              { Icon: PhoneIcon, text: 'スマホ首が気になる。猫背と言われる' },
              { Icon: BoltIcon, text: '運動したいけど、何をすればいいか分からない' },
              { Icon: PillIcon, text: '湿布や痛み止めだけに頼らず、自分でできるケアを知りたい' },
              // 2026-10-01: 「整体・接骨院に通う時間とお金がかかる」は、院の患者さんに「通院は無駄」と読めるため変更
              { Icon: BuildingIcon, text: '通院の合間に、家で何をすればいいか分からない' },
            ].map((item, idx) => (
              <AnimateOnScroll
                key={idx}
                animation="fade-up"
                delay={idx * 80}
              >
                <div className="flex items-start gap-4 p-5 rounded-2xl bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 hover:-translate-y-1 hover:shadow-md transition-all duration-300">
                  <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                    <item.Icon className="w-6 h-6" />
                  </div>
                  <p className="text-slate-700 text-sm sm:text-base leading-relaxed pt-2">
                    {item.text}
                  </p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
          <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
            <div className="relative w-32 sm:w-40 flex-shrink-0 lp-float-slow">
              <div className="relative w-full aspect-square">
                <Image
                  src="/icon-skeleton-sensei.png"
                  alt="ガイコツ先生"
                  fill
                  sizes="(min-width: 640px) 160px, 128px"
                  className="object-contain drop-shadow-xl"
                />
              </div>
            </div>
            <div className="relative max-w-md">
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl px-6 py-5 shadow-md">
                <p className="text-base sm:text-lg text-slate-800 leading-relaxed">
                  ひとりで抱えずに、AI と一緒に<br className="sm:hidden" />
                  <strong className="text-emerald-700">少しずつ続けていきましょう。</strong>
                </p>
                <p className="text-xs sm:text-sm text-slate-500 mt-2">
                  — ガイコツ先生（あなた専属AIトレーナー）
                </p>
              </div>
              {/* 吹き出しのしっぽ - PC のみ左向き */}
              <span className="hidden sm:block absolute top-8 -left-3 w-6 h-6 bg-gradient-to-br from-emerald-50 to-emerald-50 border-l border-b border-emerald-200 transform rotate-45" />
            </div>
          </div>
        </div>
      </section>

      {/* ===== Features ===== */}
      <section className="py-16 sm:py-24 bg-gradient-to-b from-emerald-50/50 to-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-emerald-600 font-bold text-sm sm:text-base mb-2">
              主な機能
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              AI があなたの体を、
              <br className="sm:hidden" />
              まるごとサポート
            </h2>
          </div>

          {/* Feature 1 */}
          <FeatureRow
            badge="01"
            title="AI 姿勢分析"
            description="正面・側面の全身写真を撮るだけ。AIが頭部・肩・骨盤・膝のランドマークを検出し、骨格バランスを数値化。あなた専用の見直しポイントを提案します。"
            bullets={['全身ランドマーク検出', '左右差・前傾後傾の数値化', 'あなた向けのストレッチを自動提案']}
            image="/lp/03-result.png"
            imageAlt="姿勢分析の結果画面"
          />

          {/* Feature 2 - reversed */}
          <FeatureRow
            badge="02"
            title="ガイコツ先生のAIカウンセリング"
            description="気になる症状や悩みを、いつでも AI ガイコツ先生に相談できます。あなたの姿勢データを踏まえた、パーソナライズされたアドバイスが返ってきます。"
            bullets={['24時間いつでも相談OK', 'あなたの姿勢データを反映', '夜中でも、気になったときに相談できる']}
            image="/lp/04-counsel.png"
            imageAlt="ガイコツ先生カウンセリング画面"
            reverse
          />

          {/* Feature 3 */}
          <FeatureRow
            badge="03"
            title="AI 食事分析"
            description="食事の写真を撮るだけで AI が自動で栄養を解析。姿勢や疲労感は実は食事から。あなたに不足している栄養素まで具体的に教えてくれます。"
            bullets={['写真1枚で栄養素を自動計算', '不足栄養素をピンポイント指摘', '厚労省「食事摂取基準」準拠']}
            image="/lp/05-meal.png"
            imageAlt="食事記録画面"
          />

          {/* Feature 4 - reversed */}
          <FeatureRow
            badge="04"
            title="30日間コーチング"
            description="毎日のミッションをこなしながら、1ヶ月で姿勢と習慣をリセット。連続記録で達成感を可視化し、無理なく続けられる仕組み。"
            bullets={['日々の小さな積み重ね', '連続記録で習慣化', 'モチベーションが自動的に上がる']}
            image="/lp/06-coaching.png"
            imageAlt="30日コーチング画面"
            reverse
          />

          {/* Feature 5 */}
          <FeatureRow
            badge="05"
            title="家族プラン"
            description="家族コード1つで、家族最大4人までプレミアム機能を共有。お父さんもお母さんも、お子さんも、みんなで姿勢ケア。"
            bullets={['1契約で家族4人まで', 'アプリ内で簡単招待', '個別データは家族間でも非公開']}
            image="/lp/08-family.png"
            imageAlt="家族グループ画面"
          />
        </div>
      </section>

      {/* ===== Screenshots Gallery ===== */}
      <section className="py-16 sm:py-20 bg-white border-t border-emerald-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <p className="text-emerald-600 font-bold text-sm sm:text-base mb-2">
              アプリ画面
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              シンプル、でも本格的なセルフケア体験
            </h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {[
              { src: '/lp/01-top.png', alt: 'トップ画面' },
              { src: '/lp/11-skeleton.png', alt: '骨格チェック' },
              { src: '/lp/03-result.png', alt: '姿勢分析結果' },
              { src: '/lp/07-streak.png', alt: '連続記録グラフ' },
              { src: '/lp/05-meal.png', alt: '食事記録' },
              // 2026-10-01: 旧料金（¥1,280 など）が写った /lp/09-subscription.png は外した（画像ファイルは残してある）
              { src: '/lp/04-counsel.png', alt: 'ガイコツ先生に相談' },
            ].map((shot, idx) => (
              <AnimateOnScroll
                key={idx}
                animation="zoom-in"
                delay={idx * 70}
              >
                <div className="relative aspect-[9/18.2] rounded-2xl overflow-hidden bg-slate-900 p-1.5 shadow-lg hover:scale-105 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300">
                  <div className="relative w-full h-full rounded-xl overflow-hidden bg-white">
                    <Image
                      src={shot.src}
                      alt={shot.alt}
                      fill
                      sizes="(min-width: 1024px) 160px, (min-width: 640px) 200px, 150px"
                      className="object-cover"
                    />
                  </div>
                  <p className="absolute -bottom-7 left-0 right-0 text-center text-xs text-slate-500">
                    {shot.alt}
                  </p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
          <div className="mt-16 text-center">
            <StoreButtons />
          </div>
        </div>
      </section>

      {/* ===== How it Works ===== */}
      <section className="py-16 sm:py-24 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <p className="text-emerald-400 font-bold text-sm sm:text-base mb-2">
              使い方
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              3 ステップで始められます
            </h2>
          </div>
          {/* 2026-10-01: 無料体験はアプリ内で申し込んでから使う、という手順が抜けていたので2番目に入れた。
              申し込みの場所はアプリのメニュー名（料金プラン・7日間無料体験）に合わせる */}
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {(
              [
                {
                  step: '01',
                  title: 'ダウンロード',
                  desc: 'iPhone は App Store、Android は Google Play から ZERO-PAIN をインストール。ダウンロードは無料で、簡単な初期設定で完了。',
                  img: '/lp/10-onboarding.png',
                },
                {
                  step: '02',
                  title: '7日間の無料体験に申し込む',
                  desc: 'アプリの「メニュー」→「料金プラン・7日間無料体験」で、プランを選んで申し込みます（お支払いの登録は App Store / Google Play の画面です）。無料体験が終わる24時間前までに解約すれば料金はかかりません（解約しない場合は自動で有料プランに切り替わります）。',
                  // 狭い枠で「メニュ／ー」のように語の途中で折り返さないよう、折り返してよい切れ目で分けておく
                  guide: [
                    ['画面右下の', '「メニュー」を押す'],
                    ['「料金プラン・', '7日間無料体験」', 'を押す'],
                    ['プランを選んで', '申し込む'],
                  ],
                },
                {
                  step: '03',
                  title: '撮影して、毎日セルフケア',
                  desc: '正面と側面の全身写真を撮ると、AI が姿勢をチェック。提案されたストレッチを毎日5分、ガイコツ先生にもいつでも相談できます。',
                  img: '/lp/02-capture.png',
                },
              ] as { step: string; title: string; desc: string; img?: string; guide?: string[][] }[]
            ).map((s, sIdx) => (
              <AnimateOnScroll
                key={s.step}
                animation="fade-up"
                delay={sIdx * 150}
                className="text-center"
              >
                <div className="relative mx-auto w-44 sm:w-48 mb-4">
                  <div className="absolute -top-3 -left-3 w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-black text-lg z-10 shadow-lg">
                    {s.step}
                  </div>
                  <div className="bg-slate-800 rounded-3xl p-2 shadow-xl">
                    <div className="relative rounded-2xl overflow-hidden aspect-[9/18.2] bg-white">
                      {s.img ? (
                        <Image
                          src={s.img}
                          alt={s.title}
                          fill
                          sizes="200px"
                          className="object-cover"
                        />
                      ) : (
                        // 料金プラン画面の写真は使わない（旧料金が写っているため）。押す順番を文字で示す
                        <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-2 bg-gradient-to-b from-emerald-50 to-white text-left">
                          {s.guide?.map((g, gIdx) => (
                            <div key={gIdx}>
                              {gIdx > 0 && (
                                <p className="text-center text-emerald-500 font-black leading-none mb-1.5" aria-hidden>
                                  ↓
                                </p>
                              )}
                              <div className="rounded-xl bg-white border border-emerald-200 px-2.5 py-2 shadow-sm">
                                <p className="text-[10px] font-bold text-emerald-600">手順 {gIdx + 1}</p>
                                <p className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                  {g.map((chunk, cIdx) => (
                                    <span key={cIdx} className="inline-block">
                                      {chunk}
                                    </span>
                                  ))}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{s.desc}</p>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section className="py-16 sm:py-24 bg-white" id="pricing">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-emerald-600 font-bold text-sm sm:text-base mb-2">
              料金プラン
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              はじめての方は、7日間無料で。
            </h2>
            {/* 2026-10-01: 自動で有料に切り替わることを、無料の案内と同じ場所に書く */}
            <p className="mt-3 text-slate-600 text-sm sm:text-base leading-relaxed">
              どのプランも7日間の無料体験つきです。
              <br className="hidden sm:inline" />
              無料体験が終わる24時間前までに解約すれば料金はかかりません（解約しない場合は自動で有料プランに切り替わります）。
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
            <AnimateOnScroll animation="fade-up" delay={0}>
              <PricingCard
                name="月額プラン"
                price="880"
                period="月"
                features={[
                  'AI 姿勢分析 無制限',
                  'AI 食事分析 無制限',
                  'ガイコツ先生カウンセリング 無制限',
                  '30日コーチング',
                  '自動更新（いつでも解約できます）',
                ]}
              />
            </AnimateOnScroll>
            <AnimateOnScroll animation="fade-up" delay={150}>
              <PricingCard
                name="年額プラン"
                price="8,800"
                period="年"
                badge="2ヶ月分お得"
                recommended
                features={[
                  '月額プランのすべて',
                  '月換算 733 円',
                  // 2026-10-01: 880円×12か月＝10,560円 − 8,800円 ＝ 1,760円（旧表記「14日分お得 (¥3,560 OFF)」は誤り）
                  '月額で1年使うより1,760円お得（2か月分）',
                  '長く続ける人におすすめ',
                ]}
              />
            </AnimateOnScroll>
          </div>
          <div className="mt-6 text-center">
            <details className="inline-block text-sm text-slate-500">
              <summary className="cursor-pointer hover:text-emerald-600">
                家族プラン (最大4人) の料金を見る
              </summary>
              <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                <p>家族月額: <strong className="text-slate-900">¥1,380 / 月</strong> (1人あたり ¥345)</p>
                <p>家族年額: <strong className="text-slate-900">¥13,800 / 年</strong> (1人あたり 月 ¥287)</p>
              </div>
            </details>
          </div>
          <div className="mt-10 text-center">
            <StoreButtons />
            <p className="mt-3 text-xs text-slate-500">
              いつでも解約OK / 隠れた追加料金なし
            </p>
          </div>
        </div>
      </section>

      {/* ===== Trust / 安心要素 ===== */}
      <section className="py-14 sm:py-20 bg-emerald-50/40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <h2 className="text-center text-xl sm:text-3xl font-black tracking-tight mb-10">
            安心して使えるアプリです
          </h2>
          <div className="grid sm:grid-cols-3 gap-4 sm:gap-6">
            {[
              {
                title: '医学的根拠に基づく情報',
                desc: '厚生労働省「食事摂取基準」「健康日本21」などの公的機関の出典をベースに情報を提供。',
                Icon: BookIcon,
              },
              {
                title: 'プライバシー徹底保護',
                desc: '通信は HTTPS で暗号化、写真は分析処理のみに使用。第三者への販売・広告利用は一切なし。',
                Icon: LockIcon,
              },
              {
                // 2026-10-01: 院の患者さん向けに「院の先生が作った」ことを書く。確かめていない実績・地名・院名は書かない
                title: '治療院の先生が作ったアプリ',
                desc: '治療院の先生（カイロプラクター）が、患者さんの毎日のセルフケアのために作ったアプリです。現場で見てきた「続かない悩み」に寄り添う設計です。',
                Icon: HeartPulseIcon,
              },
            ].map((t, idx) => (
              <AnimateOnScroll key={idx} animation="fade-up" delay={idx * 120}>
                <div className="p-6 rounded-2xl bg-white border border-emerald-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-emerald-200 transition-all duration-300 h-full">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-md mb-4">
                    <t.Icon className="w-6 h-6" />
                  </div>
                  <h3 className="font-bold text-base sm:text-lg mb-2">{t.title}</h3>
                  <p className="text-sm text-slate-600 leading-relaxed">{t.desc}</p>
                </div>
              </AnimateOnScroll>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <p className="text-emerald-600 font-bold text-sm sm:text-base mb-2">
              よくある質問
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              気になる疑問にお答えします
            </h2>
          </div>
          <Faq />
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="py-20 sm:py-28 bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-0 opacity-20">
          <div className="absolute top-10 left-10 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative w-32 sm:w-40 mx-auto mb-6 drop-shadow-2xl lp-float">
            <Image
              src="/icon-skeleton-sensei.png"
              alt="ガイコツ先生"
              width={160}
              height={160}
              className="mx-auto"
            />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4" style={{ color: '#ffffff' }}>
            <span className="inline-block">毎日のセルフケアを、</span>
            <span className="inline-block">今日から。</span>
          </h2>
          {/* 2026-10-01: 「合わなければ、料金は一切かかりません」は自動更新に触れていなかったため変更 */}
          <p className="text-base sm:text-lg mb-8 leading-relaxed" style={{ color: '#ecfdf5' }}>
            はじめての方は7日間、無料で全機能をお試しいただけます。
            <br />
            無料体験が終わる24時間前までに解約すれば料金はかかりません（解約しない場合は自動で有料プランに切り替わります）。
          </p>
          <StoreButtons tone="light" />
          {/* 必要な iOS は 16.6 以上（App Store の互換性表示・Xcode の設定と同じ） */}
          <p className="mt-4 text-sm" style={{ color: 'rgba(236, 253, 245, 0.85)' }}>
            ダウンロード無料 / iOS 16.6 以上 / Android
          </p>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-slate-950 text-slate-400 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="relative w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 p-1 shadow-md overflow-hidden">
              <Image
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                fill
                sizes="36px"
                className="object-contain"
              />
            </div>
            <span className="font-bold text-white">ZERO-PAIN</span>
            <span className="text-slate-500">by TOPBANK.INC</span>
          </div>
          <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link href="/privacy?from=lp" className="hover:text-white transition-colors">
              プライバシー
            </Link>
            <Link href="/terms?from=lp" className="hover:text-white transition-colors">
              利用規約
            </Link>
            <Link href="/support?from=lp" className="hover:text-white transition-colors">
              サポート
            </Link>
            <Link href="/references?from=lp" className="hover:text-white transition-colors">
              参考文献
            </Link>
          </nav>
        </div>
        <div className="text-center text-xs text-slate-600 mt-6">
          © 2026 TOPBANK.INC All rights reserved.
        </div>
      </footer>
    </main>
  );
}

// ===== Sub Components =====

function FeatureRow({
  badge,
  title,
  description,
  bullets,
  image,
  imageAlt,
  reverse,
}: {
  badge: string;
  title: string;
  description: string;
  bullets: string[];
  image: string;
  imageAlt: string;
  reverse?: boolean;
}) {
  return (
    <div
      className={`grid lg:grid-cols-2 gap-8 lg:gap-16 items-center py-10 sm:py-16 ${
        reverse ? 'lg:[&>*:first-child]:order-2' : ''
      }`}
    >
      <AnimateOnScroll animation={reverse ? 'fade-left' : 'fade-right'}>
        <div className="space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 font-black text-lg">
            {badge}
          </div>
          <h3 className="text-2xl sm:text-3xl font-black tracking-tight">
            {title}
          </h3>
          <p className="text-slate-600 text-base sm:text-lg leading-relaxed">
            {description}
          </p>
          <ul className="space-y-2 pt-2">
            {bullets.map((b, idx) => (
              <li key={idx} className="flex items-start gap-2 text-slate-700">
                <svg
                  className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-sm sm:text-base">{b}</span>
              </li>
            ))}
          </ul>
        </div>
      </AnimateOnScroll>
      <AnimateOnScroll animation={reverse ? 'fade-right' : 'fade-left'} delay={150}>
        <div className="relative mx-auto max-w-xs">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 to-indigo-200 rounded-[3rem] blur-2xl opacity-50 scale-105" />
          <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl hover:scale-[1.03] hover:rotate-1 transition-transform duration-500">
            <div className="relative rounded-[2.5rem] overflow-hidden bg-white aspect-[9/18.2]">
              <Image
                src={image}
                alt={imageAlt}
                fill
                sizes="(min-width: 1024px) 320px, 280px"
                className="object-cover"
              />
            </div>
          </div>
        </div>
      </AnimateOnScroll>
    </div>
  );
}

function PricingCard({
  name,
  price,
  period,
  features,
  badge,
  recommended,
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  badge?: string;
  recommended?: boolean;
}) {
  return (
    <div
      className={`relative p-6 sm:p-8 rounded-3xl border-2 ${
        recommended
          ? 'border-emerald-500 bg-gradient-to-b from-emerald-50 to-white shadow-xl'
          : 'border-slate-200 bg-white shadow-sm'
      }`}
    >
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-emerald-500 text-white text-xs font-bold shadow-md">
          {badge}
        </div>
      )}
      <h3 className="font-bold text-lg sm:text-xl mb-2">{name}</h3>
      <div className="flex items-baseline gap-1 mb-4">
        <span className="text-2xl font-bold text-slate-400">¥</span>
        <span className="text-4xl sm:text-5xl font-black">{price}</span>
        <span className="text-slate-500">/ {period}</span>
      </div>
      <ul className="space-y-2 mb-4">
        {features.map((f, idx) => (
          <li key={idx} className="flex items-start gap-2 text-sm">
            <svg
              className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-slate-700">{f}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-emerald-700 font-semibold pt-2 border-t border-slate-100 flex items-center gap-1.5">
        <SparklesIcon className="w-4 h-4" />
        はじめての方は7日間の無料体験つき
      </p>
    </div>
  );
}
