-- ========================================
-- 招待コード機能
-- ========================================
-- ユーザーごとに一意の招待コードを発行し、紹介による新規ユーザー獲得を促進

-- 招待コード管理テーブル（1ユーザー1コード）
CREATE TABLE IF NOT EXISTS invite_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,              -- 例: KOBA2026, HEALTH7X
  use_count INTEGER NOT NULL DEFAULT 0,   -- 招待成立数
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_user_id ON invite_codes(user_id);
ALTER TABLE invite_codes DISABLE ROW LEVEL SECURITY;

-- 招待履歴テーブル（誰が誰を招待したかを記録）
CREATE TABLE IF NOT EXISTS invite_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 招待した人
  invitee_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,  -- 招待された人
  invite_code TEXT NOT NULL,
  reward_granted BOOLEAN NOT NULL DEFAULT FALSE,  -- 特典付与済みか
  redeemed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (invitee_user_id)                -- 1ユーザー1回のみ招待される
);

CREATE INDEX IF NOT EXISTS idx_invite_redemptions_inviter ON invite_redemptions(inviter_user_id);
ALTER TABLE invite_redemptions DISABLE ROW LEVEL SECURITY;

-- users テーブルに「招待特典フラグ」追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS extended_trial_days INTEGER DEFAULT 0;
  -- 招待されたユーザーは 7日→14日に延長
ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_free_months INTEGER DEFAULT 0;
  -- 招待した人の無料月数（1招待成立で +1ヶ月）
