-- 食事記録に「コース料理対応」の追加写真を保存できるカラムを追加。
-- レストランで料理が順番に運ばれてきた場合、最初のレコードに皿ごとの分析を追加できる。
--
-- 各要素の構造:
-- {
--   "image_url": "...",       -- Supabase Storage の URL (元のフルパス)
--   "menu_name": "...",       -- AIが推定した皿のメニュー名
--   "calories": 320,
--   "protein_g": 22.0,
--   "carbs_g": 18.0,
--   "fat_g": 12.0,
--   "score": 80,
--   "added_at": "2026-04-29T12:34:56Z"
-- }
ALTER TABLE meal_records
  ADD COLUMN IF NOT EXISTS additional_images JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 既存行のNULL対策（DEFAULTがあるので新規行は[]、既存行も明示的に[]に）
UPDATE meal_records
  SET additional_images = '[]'::jsonb
  WHERE additional_images IS NULL;
