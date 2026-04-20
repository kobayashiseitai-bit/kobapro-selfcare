-- ========================================
-- 家族プラン機能
-- Supabase SQL Editor で実行してください
-- ========================================

-- 1. families テーブル: 家族グループ
CREATE TABLE IF NOT EXISTS families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,                                     -- 例: "小林ファミリー"（任意）
  invite_code VARCHAR(8) UNIQUE NOT NULL,        -- 8桁の招待コード
  max_members INT DEFAULT 4,                     -- 最大4人まで
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. family_members テーブル: 家族メンバー
CREATE TABLE IF NOT EXISTS family_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'member',             -- 'owner' | 'member'
  share_data BOOLEAN DEFAULT TRUE,               -- 健康データを家族と共有OK?
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(family_id, user_id)                     -- 1家族につき1人1回まで
);

-- 3. インデックス
CREATE INDEX IF NOT EXISTS idx_family_members_user ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_family ON family_members(family_id);
CREATE INDEX IF NOT EXISTS idx_families_invite_code ON families(invite_code);

-- 4. RLS無効（API側でユーザー認可するため）
ALTER TABLE families DISABLE ROW LEVEL SECURITY;
ALTER TABLE family_members DISABLE ROW LEVEL SECURITY;

-- 5. 動作確認
SELECT 'families と family_members テーブル作成完了' AS status;
