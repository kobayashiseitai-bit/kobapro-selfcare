'use client';

import { useEffect, useState } from 'react';
import { AppleIcon, DownloadIcon, GooglePlayIcon } from './icons';

/**
 * スマホ表示の上部ヘッダーにある「入手」ボタン（2026-10-01）
 *
 * ヘッダーは幅が狭く、App Store と Google Play の2つを並べると幅360pxの Android で収まらない。
 * そこで端末を見分けて、合う方のストアを直接開く。
 * - Android → Google Play
 * - iPhone → App Store
 * - 見分けられないとき（読み込み直後・iPad・PCの狭い画面など）→ ページ上部の2つ並びのボタン（#download）へ移るだけ
 *
 * URL はサーバー側の page.tsx から受け取る（'use client' のファイルから定数を書き出すと、
 * サーバー側では文字列として読めないため）。
 */
type Os = 'ios' | 'android' | null;

export default function HeaderGetButton({
  appStoreUrl,
  googlePlayUrl,
}: {
  appStoreUrl: string;
  googlePlayUrl: string;
}) {
  const [os, setOs] = useState<Os>(null);

  useEffect(() => {
    const ua = navigator.userAgent;
    if (/android/i.test(ua)) setOs('android');
    else if (/iphone|ipod/i.test(ua)) setOs('ios');
  }, []);

  const href = os === 'android' ? googlePlayUrl : os === 'ios' ? appStoreUrl : '#download';
  const label =
    os === 'android' ? 'Google Play で入手' : os === 'ios' ? 'App Store で入手' : 'アプリの入手方法へ';
  const Icon = os === 'android' ? GooglePlayIcon : os === 'ios' ? AppleIcon : DownloadIcon;

  return (
    <a
      href={href}
      {...(os ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      aria-label={label}
      className="sm:hidden inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full font-semibold text-sm shadow-md flex-shrink-0 whitespace-nowrap active:scale-95 transition-transform"
      style={{ background: '#0f172a', color: '#ffffff' }}
    >
      <Icon className="w-4 h-4" style={{ color: '#ffffff' }} />
      <span style={{ color: '#ffffff' }}>入手</span>
    </a>
  );
}
