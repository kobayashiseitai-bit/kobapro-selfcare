/**
 * 症状アイコン(カスタムSVG)
 *
 * 人物の特定部位に「痛みマーク(雷)」を配置した、誰でも一目で分かるアイコン。
 * lucide-react のストロークスタイルと統一性を保つ設計。
 */

interface SymptomIconProps {
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const baseProps = (size: number, strokeWidth: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className,
});

/** 首こり: 横向きの頭+首のシルエット + 首部分に痛みマーク */
export function NeckPainIcon({ size = 24, strokeWidth = 2, className }: SymptomIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      {/* 頭部(横向き) */}
      <circle cx="8" cy="6" r="3" />
      {/* 首 */}
      <path d="M8 9 L8 14" />
      {/* 肩(肩のライン) */}
      <path d="M3 14 L13 14" />
      {/* 痛みマーク(雷)— 首の右側 */}
      <path d="M15 6 L18 9.5 L16 9.5 L18 13" strokeWidth={strokeWidth + 0.4} />
    </svg>
  );
}

/** 肩こり: 上半身正面 + 肩部分に痛みマーク */
export function ShoulderPainIcon({ size = 24, strokeWidth = 2, className }: SymptomIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      {/* 頭 */}
      <circle cx="12" cy="5" r="2.5" />
      {/* 首 */}
      <path d="M12 7.5 L12 10" />
      {/* 肩のライン(なで肩) */}
      <path d="M4.5 12 Q4.5 10 6.5 10 L17.5 10 Q19.5 10 19.5 12" />
      {/* 体の上半身 */}
      <path d="M5 12 L5 17" />
      <path d="M19 12 L19 17" />
      {/* 痛みマーク(雷)— 右肩 */}
      <path d="M21 4 L23 6.5 L21.5 6.5 L23 9" strokeWidth={strokeWidth + 0.4} />
      {/* 痛みマーク(雷)— 左肩 */}
      <path d="M3 4 L1 6.5 L2.5 6.5 L1 9" strokeWidth={strokeWidth + 0.4} />
    </svg>
  );
}

/** 腰痛: 横向きの体+背骨カーブ + 腰部分に痛みマーク */
export function BackPainIcon({ size = 24, strokeWidth = 2, className }: SymptomIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      {/* 頭 */}
      <circle cx="8" cy="4" r="2.5" />
      {/* 背骨(緩やかなS字) */}
      <path d="M8 7 Q11 11 8 14 Q5 17 8 20" />
      {/* 痛みマーク(雷)— 腰の右側 */}
      <path d="M14 14 L17 17 L15.5 17 L17 20" strokeWidth={strokeWidth + 0.4} />
      {/* 強調マーク(腰の位置を示す) */}
      <circle cx="9" cy="15.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 頭痛: 頭+周りに放射状の痛みライン */
export function HeadachePainIcon({ size = 24, strokeWidth = 2, className }: SymptomIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      {/* 頭 */}
      <circle cx="12" cy="13" r="5" />
      {/* 放射状の痛みライン */}
      <path d="M12 4 L12 6" strokeWidth={strokeWidth + 0.3} />
      <path d="M5 7 L6.5 8" strokeWidth={strokeWidth + 0.3} />
      <path d="M19 7 L17.5 8" strokeWidth={strokeWidth + 0.3} />
      <path d="M3 13 L5 13" strokeWidth={strokeWidth + 0.3} />
      <path d="M21 13 L19 13" strokeWidth={strokeWidth + 0.3} />
      {/* 額のしわ(痛みの表現) */}
      <path d="M10 11 L11 11.5" />
      <path d="M13 11.5 L14 11" />
    </svg>
  );
}

/** 眼精疲労: 目 + 涙/疲れマーク */
export function EyeFatigueIcon({ size = 24, strokeWidth = 2, className }: SymptomIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      {/* 目の輪郭(アーモンド型) */}
      <path d="M2 12 Q12 5 22 12 Q12 19 2 12 Z" />
      {/* 瞳 */}
      <circle cx="12" cy="12" r="2.5" />
      {/* 涙(疲れの表現) */}
      <path d="M9 17 L9 19.5" strokeWidth={strokeWidth + 0.3} />
      <path d="M15 17 L15 19.5" strokeWidth={strokeWidth + 0.3} />
    </svg>
  );
}

/** 猫背改善: 横向きの人物シルエット(姿勢) */
export function PostureIcon({ size = 24, strokeWidth = 2, className }: SymptomIconProps) {
  return (
    <svg {...baseProps(size, strokeWidth, className)}>
      {/* 頭(やや前傾) */}
      <circle cx="10" cy="4" r="2.5" />
      {/* 背骨(猫背の曲線) */}
      <path d="M10 7 Q14 10 12 14 L12 19" />
      {/* 矢印(改善の方向) */}
      <path d="M16 10 L19 7 M19 7 L17 7 M19 7 L19 9" strokeWidth={strokeWidth + 0.3} />
      {/* 足元 */}
      <path d="M9 19 L15 19" />
    </svg>
  );
}
