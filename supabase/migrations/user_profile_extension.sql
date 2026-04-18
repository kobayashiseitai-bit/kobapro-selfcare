-- ========================================
-- ユーザープロフィール拡張
-- ========================================
-- 身長・体重・性別・活動レベルを users テーブルに追加
-- （既存のユーザー情報は保持されます）

ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5, 1);
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
  -- 'male' / 'female' / 'other'
ALTER TABLE users ADD COLUMN IF NOT EXISTS activity_level TEXT;
  -- 'sedentary' (運動なし)
  -- 'light'     (週1-2回)
  -- 'moderate'  (普通)
  -- 'active'    (よく運動)
  -- 'very_active' (アスリート)

-- ========================================
-- 体重記録テーブル
-- ========================================
-- 週次などで体重を記録し、推移を可視化
CREATE TABLE IF NOT EXISTS weight_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5, 1) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weight_records_user_recorded
  ON weight_records(user_id, recorded_at DESC);

ALTER TABLE weight_records DISABLE ROW LEVEL SECURITY;

-- ========================================
-- nutrition_goals に目標体重・目標期間を追加
-- ========================================
ALTER TABLE nutrition_goals ADD COLUMN IF NOT EXISTS target_weight_kg NUMERIC(5, 1);
ALTER TABLE nutrition_goals ADD COLUMN IF NOT EXISTS target_period_weeks INTEGER;
