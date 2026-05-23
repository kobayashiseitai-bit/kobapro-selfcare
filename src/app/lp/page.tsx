import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import Faq from './Faq';

export const metadata: Metadata = {
  title: 'ZERO-PAIN | AI姿勢分析・セルフケアで「痛みゼロ」へ',
  description:
    'AI姿勢分析・AI食事分析・ガイコツ先生のカウンセリング・30日コーチング。あなた専用のAIパーソナルトレーナーで、肩こり・腰痛・姿勢の悩みをセルフケアに。7日間無料で試せる iPhone アプリ。',
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
  ],
  alternates: {
    canonical: 'https://posture-app-steel.vercel.app/lp',
  },
  openGraph: {
    title: 'ZERO-PAIN | AI姿勢分析で「痛みゼロ」へ',
    description:
      'あなた専用のAIパーソナルトレーナー。姿勢チェック・セルフケア・痛み予測で体の悩みをゼロに。7日間無料トライアル。',
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
    title: 'ZERO-PAIN | AI姿勢分析で「痛みゼロ」へ',
    description:
      'あなた専用のAIパーソナルトレーナー。7日間無料トライアル。',
    images: ['https://posture-app-steel.vercel.app/og-image.jpg'],
  },
};

const APP_STORE_URL = 'https://apps.apple.com/app/zero-pain/id6768903915';

// JSON-LD: SoftwareApplication
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'ZERO-PAIN',
  operatingSystem: 'iOS',
  applicationCategory: 'HealthApplication',
  description:
    'AI姿勢分析・食事分析・カウンセリング・30日コーチングを備えたセルフケアアプリ',
  offers: {
    '@type': 'Offer',
    price: '1280',
    priceCurrency: 'JPY',
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '5.0',
    ratingCount: '1',
  },
  url: APP_STORE_URL,
};

function AppStoreButton({ size = 'lg' }: { size?: 'lg' | 'md' }) {
  const sizing =
    size === 'lg'
      ? 'px-7 py-4 text-base sm:text-lg'
      : 'px-5 py-3 text-sm sm:text-base';
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 ${sizing} rounded-full font-semibold shadow-lg shadow-slate-900/20 hover:opacity-90 transition-all hover:scale-[1.02] active:scale-[0.98]`}
      style={{ background: '#0f172a', color: '#ffffff' }}
    >
      <svg
        className="w-5 h-5 sm:w-6 sm:h-6"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        style={{ color: '#ffffff' }}
      >
        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
      </svg>
      <span style={{ color: '#ffffff' }}>App Store でダウンロード</span>
    </a>
  );
}

export default function LPPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-emerald-50 text-slate-900">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* ===== Sticky Header ===== */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-emerald-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 p-1 shadow-md overflow-hidden">
              <Image
                src="/icon-skeleton-sensei-face.png"
                alt="ガイコツ先生"
                fill
                sizes="40px"
                className="object-contain"
              />
            </div>
            <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900">
              ZERO-PAIN
            </span>
          </div>
          <AppStoreButton size="md" />
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
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs sm:text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              App Store 配信開始
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
              肩こり・腰痛・姿勢の悩みを <strong className="text-slate-900">ゼロ</strong> へ。
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-center lg:justify-start">
              <AppStoreButton size="lg" />
              <p className="text-xs sm:text-sm text-slate-500">
                7日間無料 / いつでも解約可
              </p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center lg:justify-start pt-2 text-xs sm:text-sm text-slate-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                医学的根拠に基づく出典
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                Apple HealthKit 連携
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                家族プラン対応
              </span>
            </div>
          </div>
          <div className="relative mx-auto lg:mx-0 max-w-xs sm:max-w-sm">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-300 to-indigo-300 rounded-[3rem] blur-2xl opacity-30 scale-105" />
            <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
              <div className="relative rounded-[2.5rem] overflow-hidden bg-white aspect-[9/19.5]">
                <Image
                  src="/lp/01-top.png"
                  alt="ZERO-PAIN トップ画面"
                  fill
                  sizes="(min-width: 1024px) 384px, 320px"
                  className="object-cover"
                  priority
                />
              </div>
            </div>
            {/* ガイコツ先生キャラ - iPhone モックの右下に配置 */}
            <div className="absolute -bottom-6 -right-6 sm:-bottom-10 sm:-right-10 w-32 sm:w-44 lg:w-52 z-10 pointer-events-none">
              <div className="relative w-full aspect-square drop-shadow-2xl">
                <Image
                  src="/icon-skeleton-sensei.png"
                  alt="ガイコツ先生"
                  fill
                  sizes="(min-width: 1024px) 208px, 176px"
                  className="object-contain"
                  priority
                />
              </div>
              <div className="absolute -top-4 sm:-top-6 -left-4 sm:-left-8 bg-white rounded-2xl px-3 py-2 shadow-lg border border-emerald-100 text-xs sm:text-sm font-bold text-emerald-700 whitespace-nowrap">
                先生にお任せ！
                <span className="absolute -bottom-2 right-6 w-3 h-3 bg-white border-r border-b border-emerald-100 transform rotate-45" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pain Points (共感) ===== */}
      <section className="bg-white py-16 sm:py-24">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <p className="text-emerald-600 font-bold text-sm sm:text-base mb-2">
              こんな悩み、ありませんか？
            </p>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight">
              「もう何年も付き合っている痛み」
              <br className="sm:hidden" />
              卒業しませんか。
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {[
              { emoji: '💻', text: 'デスクワークで肩がガチガチ。マッサージに行ってもすぐ戻る' },
              { emoji: '🛏️', text: '朝起きると腰が重い。何が原因か分からない' },
              { emoji: '📱', text: 'スマホ首が気になる。猫背と言われる' },
              { emoji: '🏃', text: '運動したいけど、何をすればいいか分からない' },
              { emoji: '💊', text: '湿布や痛み止めに頼りがちで、根本改善したい' },
              { emoji: '🏥', text: '整体・接骨院に通う時間とお金がかかる' },
            ].map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-3 p-5 rounded-2xl bg-slate-50 border border-slate-100"
              >
                <span className="text-2xl flex-shrink-0">{item.emoji}</span>
                <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-8">
            <div className="relative w-32 sm:w-40 flex-shrink-0">
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
                  全部、AI と一緒に向き合えば<br className="sm:hidden" />
                  <strong className="text-emerald-700">解決できますよ。</strong>
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
            description="正面・側面の全身写真を撮るだけ。AIが頭部・肩・骨盤・膝のランドマークを検出し、骨格バランスを数値化。あなた専用の改善ポイントを提案します。"
            bullets={['全身ランドマーク検出', '左右差・前傾後傾の数値化', '改善ストレッチを自動提案']}
            image="/lp/03-result.png"
            imageAlt="姿勢分析の結果画面"
          />

          {/* Feature 2 - reversed */}
          <FeatureRow
            badge="02"
            title="ガイコツ先生のAIカウンセリング"
            description="気になる症状や悩みを、いつでも AI ガイコツ先生に相談できます。あなたの姿勢データを踏まえた、パーソナライズされたアドバイスが返ってきます。"
            bullets={['24時間いつでも相談OK', 'あなたの姿勢データを反映', '深夜の腰痛も即座に対応']}
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
            description="招待コード1つで、家族最大4人までプレミアム機能を共有。お父さんもお母さんも、お子さんも、みんなで姿勢ケア。"
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
              { src: '/lp/09-subscription.png', alt: 'プラン管理' },
            ].map((shot, idx) => (
              <div
                key={idx}
                className="relative aspect-[9/19.5] rounded-2xl overflow-hidden bg-slate-900 p-1.5 shadow-lg hover:scale-105 transition-transform"
              >
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
            ))}
          </div>
          <div className="mt-16 text-center">
            <AppStoreButton size="lg" />
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
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: '01',
                title: 'ダウンロード',
                desc: 'App Store から ZERO-PAIN をインストール。簡単な初期設定で完了。',
                img: '/lp/10-onboarding.png',
              },
              {
                step: '02',
                title: '全身写真を撮影',
                desc: '正面と側面、合計2枚の全身写真を撮影。あとは AI にお任せ。',
                img: '/lp/02-capture.png',
              },
              {
                step: '03',
                title: '毎日セルフケア',
                desc: 'AIが提案するストレッチを毎日5分。30日コーチングで習慣化。',
                img: '/lp/06-coaching.png',
              },
            ].map((s) => (
              <div key={s.step} className="text-center">
                <div className="relative mx-auto w-44 sm:w-48 mb-4">
                  <div className="absolute -top-3 -left-3 w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center font-black text-lg z-10 shadow-lg">
                    {s.step}
                  </div>
                  <div className="bg-slate-800 rounded-3xl p-2 shadow-xl">
                    <div className="relative rounded-2xl overflow-hidden aspect-[9/19.5] bg-white">
                      <Image
                        src={s.img}
                        alt={s.title}
                        fill
                        sizes="200px"
                        className="object-cover"
                      />
                    </div>
                  </div>
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2">{s.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{s.desc}</p>
              </div>
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
              まずは7日間、無料で。
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              すべてのプランで7日間無料トライアル。
              <br className="sm:hidden" />
              期間中はいつでもキャンセル可能。
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 max-w-3xl mx-auto">
            <PricingCard
              name="月額プラン"
              price="1,280"
              period="月"
              features={[
                'AI 姿勢分析 無制限',
                'AI 食事分析 無制限',
                'ガイコツ先生カウンセリング 無制限',
                '30日コーチング',
                'HealthKit 連携',
              ]}
            />
            <PricingCard
              name="年額プラン"
              price="12,800"
              period="年"
              badge="2ヶ月分お得"
              recommended
              features={[
                '月額プランのすべて',
                '月換算 1,067 円',
                '14日分お得 (¥3,560 OFF)',
                '長く続ける人におすすめ',
              ]}
            />
          </div>
          <div className="mt-6 text-center">
            <details className="inline-block text-sm text-slate-500">
              <summary className="cursor-pointer hover:text-emerald-600">
                家族プラン (最大4人) の料金を見る
              </summary>
              <div className="mt-3 px-4 py-3 rounded-xl bg-slate-50 border border-slate-100 text-left">
                <p>家族月額: <strong className="text-slate-900">¥1,980 / 月</strong> (1人あたり ¥495)</p>
                <p>家族年額: <strong className="text-slate-900">¥19,800 / 年</strong> (1人あたり 月 ¥412)</p>
              </div>
            </details>
          </div>
          <div className="mt-10 text-center">
            <AppStoreButton size="lg" />
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
                icon: '📚',
              },
              {
                title: 'プライバシー徹底保護',
                desc: '通信は HTTPS で暗号化、写真は分析処理のみに使用。第三者への販売・広告利用は一切なし。',
                icon: '🔒',
              },
              {
                title: 'Apple ヘルスケア連携',
                desc: '歩数・睡眠・心拍データを連携することで、より精度の高いセルフケア提案が可能に。',
                icon: '❤️',
              },
            ].map((t, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl bg-white border border-emerald-100 shadow-sm"
              >
                <div className="text-3xl mb-3">{t.icon}</div>
                <h3 className="font-bold text-base sm:text-lg mb-2">{t.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t.desc}</p>
              </div>
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
          <div className="relative w-32 sm:w-40 mx-auto mb-6 drop-shadow-2xl">
            <Image
              src="/icon-skeleton-sensei.png"
              alt="ガイコツ先生"
              width={160}
              height={160}
              className="mx-auto"
            />
          </div>
          <h2 className="text-3xl sm:text-5xl font-black tracking-tight mb-4" style={{ color: '#ffffff' }}>
            痛みのない毎日を、今日から。
          </h2>
          <p className="text-base sm:text-lg mb-8 leading-relaxed" style={{ color: '#ecfdf5' }}>
            7日間無料で全機能をお試し。
            <br />
            合わなければ、料金は一切かかりません。
          </p>
          <a
            href={APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 px-8 py-5 rounded-full bg-white font-black text-lg sm:text-xl shadow-2xl hover:scale-[1.03] active:scale-[0.98] transition-transform"
            style={{ color: '#047857' }}
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
            </svg>
            App Store で無料ダウンロード
          </a>
          <p className="mt-4 text-sm" style={{ color: 'rgba(236, 253, 245, 0.85)' }}>
            iPhone 専用 / iOS 16.0 以上
          </p>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-slate-950 text-slate-400 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-xs">
              ZP
            </div>
            <span className="font-bold text-white">ZERO-PAIN</span>
            <span className="text-slate-500">by TOPBANK.INC</span>
          </div>
          <nav className="flex flex-wrap items-center gap-4 sm:gap-6">
            <Link href="/privacy" className="hover:text-white transition-colors">
              プライバシー
            </Link>
            <Link href="/terms" className="hover:text-white transition-colors">
              利用規約
            </Link>
            <Link href="/support" className="hover:text-white transition-colors">
              サポート
            </Link>
            <Link href="/references" className="hover:text-white transition-colors">
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
      <div className="relative mx-auto max-w-xs">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-200 to-indigo-200 rounded-[3rem] blur-2xl opacity-50 scale-105" />
        <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
          <div className="relative rounded-[2.5rem] overflow-hidden bg-white aspect-[9/19.5]">
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
      <p className="text-xs text-emerald-700 font-semibold pt-2 border-t border-slate-100">
        ✨ 7日間無料トライアル付き
      </p>
    </div>
  );
}
