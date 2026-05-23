/**
 * LP 専用 SVG アイコンセット
 * Heroicons (Tailwind 製) スタイル準拠、24x24 viewBox、stroke 1.5
 * Stripe / Linear / Apple が採用しているのと同系統の線画アイコン
 */
import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

const baseProps: IconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

// ===== Pain Points 用 =====
export function LaptopIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M2 20h20" />
      <path d="M8 16v4" />
      <path d="M16 16v4" />
    </svg>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}

export function BoltIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M13 2L4.5 13h6.5l-1 9 8.5-11h-6.5l1-9z" />
    </svg>
  );
}

export function PillIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M10.5 20.5a5.66 5.66 0 0 1-8-8L13.5 1.5a5.66 5.66 0 0 1 8 8z" />
      <path d="M8.5 8.5l7 7" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 9h.01" />
      <path d="M15 9h.01" />
      <path d="M9 13h.01" />
      <path d="M15 13h.01" />
      <path d="M10 21v-4h4v4" />
    </svg>
  );
}

// ===== Trust 用 =====
export function BookIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5a2.5 2.5 0 0 0 0 5H20" />
      <path d="M9 7h7" />
      <path d="M9 11h7" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <rect x="4" y="11" width="16" height="11" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      <circle cx="12" cy="16.5" r="1" fill="currentColor" />
    </svg>
  );
}

export function HeartPulseIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
      <path d="M3.5 13h3l2-4 3 7 2-3h7" />
    </svg>
  );
}

// ===== その他 =====
export function SparklesIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M12 3v3M12 18v3M5 12H2M22 12h-3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
      <path d="M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5L12 8z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...baseProps} {...props}>
      <path d="M5 12h14" />
      <path d="M13 5l7 7-7 7" />
    </svg>
  );
}
