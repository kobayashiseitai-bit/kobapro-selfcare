-- ========================================
-- MYセット（お気に入り食事組み合わせ）
-- ========================================
-- ユーザーが「よく食べる組み合わせ」を保存して1タップ記録可能に
-- 例: 「いつもの朝食」「プロテイン昼食」
CREATE TABLE IF NOT EXISTS my_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                    -- 「いつもの朝食」等
  meal_type TEXT,                        -- 朝食 / 昼食 / 夕食 / 間食（null=共通）
  menu_name TEXT NOT NULL,               -- 記録時のメニュー名
  calories INTEGER,
  protein_g NUMERIC(5, 1),
  carbs_g NUMERIC(5, 1),
  fat_g NUMERIC(5, 1),
  icon TEXT,                             -- 絵文字1文字（🍚🥗🍜等）
  use_count INTEGER NOT NULL DEFAULT 0,  -- 使用回数（頻出順ソート用）
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_my_sets_user_id ON my_sets(user_id, last_used_at DESC NULLS LAST);
ALTER TABLE my_sets DISABLE ROW LEVEL SECURITY;
