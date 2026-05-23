'use client';

import { useEffect, useRef, useState, ReactNode } from 'react';

type AnimationType = 'fade-up' | 'fade-in' | 'fade-left' | 'fade-right' | 'zoom-in';

interface Props {
  children: ReactNode;
  /** アニメーション種別 */
  animation?: AnimationType;
  /** 発火遅延 (ms) */
  delay?: number;
  /** スクロール検知の閾値 (0-1) */
  threshold?: number;
  /** カスタムクラス */
  className?: string;
  /** 一度だけ発火するか (false にすると毎回) */
  once?: boolean;
}

export default function AnimateOnScroll({
  children,
  animation = 'fade-up',
  delay = 0,
  threshold = 0.15,
  className = '',
  once = true,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    // prefers-reduced-motion 対応
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) observer.disconnect();
          } else if (!once) {
            setVisible(false);
          }
        });
      },
      { threshold, rootMargin: '0px 0px -50px 0px' }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold, once]);

  const animationClass: Record<AnimationType, { hidden: string; visible: string }> = {
    'fade-up': {
      hidden: 'opacity-0 translate-y-8',
      visible: 'opacity-100 translate-y-0',
    },
    'fade-in': {
      hidden: 'opacity-0',
      visible: 'opacity-100',
    },
    'fade-left': {
      hidden: 'opacity-0 translate-x-8',
      visible: 'opacity-100 translate-x-0',
    },
    'fade-right': {
      hidden: 'opacity-0 -translate-x-8',
      visible: 'opacity-100 translate-x-0',
    },
    'zoom-in': {
      hidden: 'opacity-0 scale-95',
      visible: 'opacity-100 scale-100',
    },
  };

  const { hidden, visible: visClass } = animationClass[animation];

  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${
        visible ? visClass : hidden
      } ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
