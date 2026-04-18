/**
 * 栄養計算ライブラリ（科学的根拠に基づく）
 * Harris-Benedict 式 + 活動代謝係数 + 目標別調整
 */

export type Gender = "male" | "female" | "other";
export type ActivityLevel =
  | "sedentary" // 運動なし
  | "light" // 週1-2回
  | "moderate" // 普通
  | "active" // よく運動
  | "very_active"; // アスリート
export type GoalType = "diet" | "maintain" | "muscle";

export interface ProfileInput {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  age: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  targetWeightKg?: number;
  targetPeriodWeeks?: number;
}

export interface NutritionRecommendation {
  bmi: number;
  bmiCategory: string;
  bmr: number; // 基礎代謝
  tdee: number; // 1日総消費カロリー
  recommendedCalories: number;
  recommendedProteinG: number;
  recommendedCarbsG: number;
  recommendedFatG: number;
  weeklyWeightChange: number; // 予想週間体重変化(kg、-は減量)
  estimatedWeeksToGoal: number | null;
}

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, { label: string; desc: string }> = {
  sedentary: { label: "💺 運動なし", desc: "1日中座り仕事" },
  light: { label: "🚶 軽め", desc: "週1〜2回運動" },
  moderate: { label: "🏃 普通", desc: "週3〜4回運動" },
  active: { label: "💪 活発", desc: "週5回以上運動" },
  very_active: { label: "🔥 アスリート", desc: "毎日激しい運動" },
};

export const GENDER_LABELS: Record<Gender, string> = {
  male: "男性",
  female: "女性",
  other: "その他",
};

export const GOAL_LABELS: Record<GoalType, { label: string; desc: string; emoji: string }> = {
  diet: { label: "ダイエット", desc: "体重を減らしたい", emoji: "🥗" },
  maintain: { label: "体重維持", desc: "今の体重をキープ", emoji: "⚖️" },
  muscle: { label: "筋肉増量", desc: "筋肉をつけたい", emoji: "💪" },
};

// ============== 計算関数 ==============

export function calculateBMI(heightCm: number, weightKg: number): number {
  if (!heightCm || !weightKg) return 0;
  const m = heightCm / 100;
  return Number((weightKg / (m * m)).toFixed(1));
}

export function bmiCategory(bmi: number): string {
  if (bmi < 18.5) return "低体重";
  if (bmi < 25) return "標準";
  if (bmi < 30) return "やや肥満";
  return "肥満";
}

/**
 * 基礎代謝（BMR）- Harris-Benedict式（1984年改訂版）
 */
export function calculateBMR(profile: {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  age: number;
}): number {
  const { gender, heightCm, weightKg, age } = profile;
  if (!heightCm || !weightKg || !age) return 0;

  let bmr: number;
  if (gender === "male") {
    bmr = 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * age;
  } else {
    // female / other はfemale式を使用（安全側）
    bmr = 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * age;
  }
  return Math.round(bmr);
}

/**
 * 1日総消費カロリー（TDEE）
 */
export function calculateTDEE(bmr: number, activityLevel: ActivityLevel): number {
  return Math.round(bmr * ACTIVITY_MULTIPLIERS[activityLevel]);
}

/**
 * 目標別推奨カロリー・タンパク質
 */
export function calculateRecommendation(profile: ProfileInput): NutritionRecommendation {
  const { gender, heightCm, weightKg, age, activityLevel, goalType, targetWeightKg, targetPeriodWeeks } =
    profile;

  const bmi = calculateBMI(heightCm, weightKg);
  const bmr = calculateBMR({ gender, heightCm, weightKg, age });
  const tdee = calculateTDEE(bmr, activityLevel);

  // 目標別カロリー調整
  let calorieAdjustment = 0;
  let proteinPerKg = 1.2;
  let fatRatio = 0.25; // 脂質は総カロリーの25%
  let carbsRatio = 0.5; // 炭水化物は総カロリーの50%

  if (goalType === "diet") {
    // ダイエット: 20%減（極端な減量を避けるため）
    calorieAdjustment = -0.2;
    proteinPerKg = 1.8;
    fatRatio = 0.25;
    carbsRatio = 0.45;
  } else if (goalType === "muscle") {
    // 筋肉増量: 15%増
    calorieAdjustment = 0.15;
    proteinPerKg = 2.0;
    fatRatio = 0.25;
    carbsRatio = 0.55;
  } else {
    // 維持
    calorieAdjustment = 0;
    proteinPerKg = 1.2;
  }

  const recommendedCalories = Math.round(tdee * (1 + calorieAdjustment));
  const recommendedProteinG = Math.round(weightKg * proteinPerKg);
  const recommendedFatG = Math.round((recommendedCalories * fatRatio) / 9); // 脂質は9kcal/g
  const recommendedCarbsG = Math.round((recommendedCalories * carbsRatio) / 4); // 糖質は4kcal/g

  // 週間体重変化予測（1kgの脂肪 ≈ 7,200kcal）
  const dailyDeficit = tdee - recommendedCalories;
  const weeklyDeficit = dailyDeficit * 7;
  const weeklyWeightChange = Number((-weeklyDeficit / 7200).toFixed(2));

  // 目標達成までの週数
  let estimatedWeeksToGoal: number | null = null;
  if (targetWeightKg && Math.abs(weeklyWeightChange) > 0.01) {
    const diff = targetWeightKg - weightKg;
    if ((diff < 0 && weeklyWeightChange < 0) || (diff > 0 && weeklyWeightChange > 0)) {
      estimatedWeeksToGoal = Math.round(Math.abs(diff / weeklyWeightChange));
    }
  }
  // 目標期間が指定されている場合は優先
  if (targetPeriodWeeks) {
    estimatedWeeksToGoal = targetPeriodWeeks;
  }

  return {
    bmi,
    bmiCategory: bmiCategory(bmi),
    bmr,
    tdee,
    recommendedCalories,
    recommendedProteinG,
    recommendedCarbsG,
    recommendedFatG,
    weeklyWeightChange,
    estimatedWeeksToGoal,
  };
}

/**
 * プロフィールが完成しているかチェック
 */
export function isProfileComplete(p: {
  height_cm?: number | null;
  weight_kg?: number | null;
  gender?: string | null;
  activity_level?: string | null;
  age?: number | null;
}): boolean {
  return !!(p.height_cm && p.weight_kg && p.gender && p.activity_level && p.age);
}
