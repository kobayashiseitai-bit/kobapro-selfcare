-- ========================================
-- 30日コーチングプログラム
-- Supabase SQL Editor で実行してください
-- ========================================

-- 1. coaching_programs: プログラム本体
CREATE TABLE IF NOT EXISTS coaching_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'active',         -- active | completed | paused | abandoned
  goal_type VARCHAR(50),                        -- posture / pain / weight / fitness / wellness
  goal_text TEXT,                               -- ゴール文（AIが生成 or ユーザー指定）
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  ai_summary TEXT,                              -- 生成時のAI概要
  ai_advice TEXT,                               -- ガイコツ先生の励ましメッセージ
  total_days INT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 2. coaching_tasks: 各日の課題
CREATE TABLE IF NOT EXISTS coaching_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES coaching_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day_number INT NOT NULL,                      -- 1〜30
  scheduled_date DATE NOT NULL,
  category VARCHAR(30),                         -- stretch | meal | mindset | check | reading
  title TEXT NOT NULL,                          -- 課題タイトル（30文字程度）
  description TEXT,                             -- 詳細説明
  symptom_id VARCHAR(30),                       -- ストレッチカテゴリへのリンク（あれば）
  estimated_minutes INT DEFAULT 5,
  completed_at TIMESTAMPTZ,
  UNIQUE(program_id, day_number)
);

-- 3. インデックス
CREATE INDEX IF NOT EXISTS idx_coaching_programs_user ON coaching_programs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_coaching_tasks_user_date ON coaching_tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_coaching_tasks_program ON coaching_tasks(program_id, day_number);

-- 4. RLS無効
ALTER TABLE coaching_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE coaching_tasks DISABLE ROW LEVEL SECURITY;

-- 5. 動作確認
SELECT 'coaching_programs と coaching_tasks テーブル作成完了' AS status;
