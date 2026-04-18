-- ========================================
-- 栄養目標設定テーブル
-- ========================================
-- ユーザーの食事目標（ダイエット・維持・筋肉増量）を管理
CREATE TABLE IF NOT EXISTS nutrition_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  goal_type TEXT NOT NULL DEFAULT 'maintain',
    -- 'diet'     : ダイエット（減量）
    -- 'maintain' : 体重維持
    -- 'muscle'   : 筋肉増量
  target_calories INTEGER NOT NULL DEFAULT 1800,
  target_protein_g NUMERIC(5, 1) NOT NULL DEFAULT 60.0,
  target_carbs_g NUMERIC(5, 1),
  target_fat_g NUMERIC(5, 1),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_nutrition_goals_user_id ON nutrition_goals(user_id);
ALTER TABLE nutrition_goals DISABLE ROW LEVEL SECURITY;
