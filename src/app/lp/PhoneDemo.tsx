'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

const SLIDES = [
  { src: '/lp/01-top.png', alt: 'ZERO-PAIN トップ画面', label: 'ホーム' },
  { src: '/lp/02-capture.png', alt: '全身撮影', label: '姿勢を撮影' },
  { src: '/lp/03-result.png', alt: '姿勢分析結果', label: 'AI が分析' },
  { src: '/lp/04-counsel.png', alt: 'ガイコツ先生のカウンセリング', label: '相談する' },
  { src: '/lp/05-meal.png', alt: '食事記録', label: '食事を記録' },
  { src: '/lp/06-coaching.png', alt: '30日コーチング', label: '習慣化' },
];

const INTERVAL_MS = 2800;

export default function PhoneDemo() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setIdx((prev) => (prev + 1) % SLIDES.length);
    }, INTERVAL_MS);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative">
      {/* iPhone モック */}
      <div className="relative bg-slate-900 rounded-[3rem] p-3 shadow-2xl">
        <div className="relative rounded-[2.5rem] overflow-hidden bg-white aspect-[9/19.5]">
          {SLIDES.map((slide, i) => (
            <div
              key={slide.src}
              className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                i === idx ? 'opacity-100' : 'opacity-0'
              }`}
              aria-hidden={i !== idx}
            >
              <Image
                src={slide.src}
                alt={slide.alt}
                fill
                sizes="(min-width: 1024px) 384px, 320px"
                className="object-cover"
                priority={i === 0}
              />
            </div>
          ))}
        </div>
        {/* 録画ランプ風アクセント */}
        <div className="absolute top-7 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-sm">
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          <span className="text-[10px] font-semibold text-white tracking-wide">
            LIVE DEMO
          </span>
        </div>
      </div>

      {/* 現在表示中のラベル (フローティング) */}
      <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-white rounded-full px-4 py-2 shadow-xl border border-emerald-100 flex items-center gap-2 whitespace-nowrap">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-sm font-bold text-slate-700">
          {SLIDES[idx].label}
        </span>
      </div>

      {/* インジケーター */}
      <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 flex gap-1.5">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIdx(i)}
            aria-label={`スライド ${i + 1} へ`}
            className={`h-1.5 rounded-full transition-all ${
              i === idx ? 'w-6 bg-emerald-500' : 'w-1.5 bg-emerald-200 hover:bg-emerald-300'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
