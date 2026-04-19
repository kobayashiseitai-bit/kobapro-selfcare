-- ========================================
-- 朝のコンディションチェック機能
-- Supabase SQL Editor で実行してください
-- ========================================

CREATE TABLE IF NOT EXISTS daily_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  checkin_date DATE NOT NULL,             -- 日付（1日1回制限のため）
  mood_level INT NOT NULL CHECK (mood_level BETWEEN 1 AND 5),  -- 1=つらい 5=絶好調
  body_note TEXT,                          -- オプション（部位コメント）
  ai_message TEXT,                         -- ガイコツ先生からの一言（キャッシュ）
  recommended_care JSONB,                  -- おすすめケア配列 [{symptomId, title, reason}]
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, checkin_date)            -- 1日1回のみ
);

-- 検索高速化用インデックス
CREATE INDEX IF NOT EXISTS idx_daily_checkins_user_date
  ON daily_checkins(user_id, checkin_date DESC);

-- RLSは無効化（deviceIdベースの認証のため、API側でユーザー確認）
ALTER TABLE daily_checkins DISABLE ROW LEVEL SECURITY;

-- 動作確認: テーブル作成済みか
SELECT 'daily_checkins テーブル作成完了' AS status;
