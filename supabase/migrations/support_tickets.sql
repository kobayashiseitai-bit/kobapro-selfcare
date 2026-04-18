-- ========================================
-- サポート問い合わせテーブル
-- ========================================
-- ユーザーからのお問い合わせを管理
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,  -- 削除ユーザー対応
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL,
    -- 'feature'   : 機能について
    -- 'bug'       : 不具合・バグ
    -- 'account'   : アカウント・課金
    -- 'feedback'  : 要望・提案
    -- 'other'     : その他
  subject TEXT,                          -- 任意の件名
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'    : 未対応
    -- 'in_progress': 対応中
    -- 'resolved'   : 解決済
    -- 'spam'       : スパム
  reply TEXT,                            -- 管理者からの返信
  device_id TEXT,                        -- 参考情報（紐付け用）
  device_info TEXT,                      -- User-Agent等のメタ情報
  created_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);

ALTER TABLE support_tickets DISABLE ROW LEVEL SECURITY;
