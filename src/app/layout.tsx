import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // iOS WKWebView でピンチズームを許可するとレイアウトが崩れるため Build 7 と同じ設定に戻す
  // 文字サイズ調整は v1.1 でアプリ内設定として実装予定
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "ZERO-PAIN",
  description: "あなた専用のAIパーソナルトレーナー。姿勢チェック・セルフケア・痛み予測で体の悩みをゼロに。",
  icons: {
    apple: [
      { url: "/app-icon-180.png?v=7", sizes: "180x180", type: "image/png" },
    ],
    icon: [
      { url: "/app-icon-192.png?v=7", sizes: "192x192", type: "image/png" },
    ],
  },
  openGraph: {
    title: "ZERO-PAIN セルフケアアプリ",
    description: "あなた専用のAIパーソナルトレーナー。姿勢チェック・セルフケア・痛み予測で体の悩みをゼロに。",
    images: [
      {
        url: "https://posture-app-steel.vercel.app/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "ZERO-PAIN",
      },
    ],
    type: "website",
    siteName: "ZERO-PAIN",
  },
  twitter: {
    card: "summary_large_image",
    title: "ZERO-PAIN セルフケアアプリ",
    description: "あなた専用のAIパーソナルトレーナー。姿勢チェック・セルフケア・痛み予測で体の悩みをゼロに。",
    images: ["https://posture-app-steel.vercel.app/og-image.jpg"],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",  // ライトテーマに合わせて白系（黒文字）に変更
    title: "ZERO-PAIN",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#ecfdf5" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#030712" media="(prefers-color-scheme: dark)" />
        {/* テーマ早期適用スクリプト（FOUC=ちらつき防止） */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  // LP は独自デザインを使うので theme-mint を適用しない
                  if (window.location.pathname.startsWith('/lp')) return;
                  var saved = localStorage.getItem('zero_pain_theme') || 'light';
                  var resolved = saved;
                  if (saved === 'system') {
                    resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  }
                  if (resolved === 'light') {
                    document.documentElement.classList.add('theme-mint');
                  }
                  // 文字サイズ設定の早期適用 (FOUC 防止)
                  var textSize = localStorage.getItem('zero_pain_text_size') || 'medium';
                  var rootSize = textSize === 'small' ? '14px'
                              : textSize === 'large' ? '18px'
                              : textSize === 'xlarge' ? '20px'
                              : '16px';
                  document.documentElement.style.fontSize = rootSize;
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
