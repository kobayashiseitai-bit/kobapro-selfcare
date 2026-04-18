-- ========================================
-- サブスクリプション管理テーブル
-- ========================================
-- ZERO-PAIN 有料プラン / 無料プラン / トライアル状態を管理
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'free',
    -- free: 無料プラン
    -- trial: 7日間無料トライアル中
    -- active_monthly: 月額課金中
    -- active_yearly: 年額課金中
    -- cancelled: 解約済み（期限まで有効）
    -- expired: 期限切れ（無料に戻る）
  plan TEXT,                          -- monthly / yearly / null
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  revenuecat_app_user_id TEXT,        -- RevenueCat連携用ID
  revenuecat_entitlement TEXT,        -- RevenueCatのentitlement名
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

ALTER TABLE subscriptions DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 利用回数カウンター
-- ========================================
-- 月次リセットされる利用回数（無料プランの制限チェック用）
-- feature: posture / chat / meal
CREATE TABLE IF NOT EXISTS usage_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,              -- 'posture' / 'chat' / 'meal'
  period_month TEXT NOT NULL,         -- '2026-04' 形式の年月
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, feature, period_month)
);

CREATE INDEX IF NOT EXISTS idx_usage_counters_user_period ON usage_counters(user_id, period_month);

ALTER TABLE usage_counters DISABLE ROW LEVEL SECURITY;

-- ========================================
-- 既存ユーザー全員に "free" ステータスを自動作成する関数
-- ========================================
CREATE OR REPLACE FUNCTION ensure_subscription_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO subscriptions (user_id, status)
  VALUES (NEW.id, 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 新規ユーザー作成時に自動でsubscriptionsに行を作る
DROP TRIGGER IF EXISTS trg_ensure_subscription ON users;
CREATE TRIGGER trg_ensure_subscription
AFTER INSERT ON users
FOR EACH ROW
EXECUTE FUNCTION ensure_subscription_for_user();

-- 既存の全ユーザー分のsubscriptionsを作成（マイグレーション時の1回のみ）
INSERT INTO subscriptions (user_id, status)
SELECT id, 'free' FROM users
ON CONFLICT (user_id) DO NOTHING;
