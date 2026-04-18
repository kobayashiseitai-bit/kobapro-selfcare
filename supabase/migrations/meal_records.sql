-- 食事記録テーブル
-- ユーザーが食事写真をアップロードしてAIが分析した結果を保存します
CREATE TABLE IF NOT EXISTS meal_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  meal_type TEXT,                  -- 朝食 / 昼食 / 夕食 / 間食
  menu_name TEXT,                  -- AIが推定したメニュー名
  calories INTEGER,                -- 推定カロリー(kcal)
  protein_g NUMERIC(5, 1),         -- タンパク質(g)
  carbs_g NUMERIC(5, 1),           -- 炭水化物(g)
  fat_g NUMERIC(5, 1),             -- 脂質(g)
  advice TEXT,                     -- AIからのアドバイス（全文）
  score INTEGER,                   -- バランススコア 0-100
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meal_records_user_id ON meal_records(user_id);
CREATE INDEX IF NOT EXISTS idx_meal_records_created_at ON meal_records(created_at DESC);

-- RLSは他のテーブルと揃えて無効化
ALTER TABLE meal_records DISABLE ROW LEVEL SECURITY;

-- Supabase Storage用: meal-images バケットを手動で作成してください
-- Dashboard → Storage → New bucket
--   Name: meal-images
--   Public: ON
