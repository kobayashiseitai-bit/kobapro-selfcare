-- ========================================
-- デバイス引継ぎコード
-- ========================================
-- 機種変更時にデータを別端末に移行するための一時コード。
-- ユーザーが「コード発行」を押すと8桁の英数字コードを生成し、
-- 別端末で「コード入力」すれば deviceId が引き継がれる。
--
-- セキュリティ:
--   - 1時間で自動失効
--   - 一度使ったらすぐ無効化
--   - 同じユーザーは新しいコード発行で旧コードを上書き
CREATE TABLE IF NOT EXISTS transfer_codes (
  code TEXT PRIMARY KEY,                          -- 8桁の英数字 (例: K7M2X9P4)
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,                        -- 引き継ぎ先に渡す deviceId
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,                -- created_at + 1時間
  used_at TIMESTAMPTZ                             -- 使用済みなら時刻を記録
);

CREATE INDEX IF NOT EXISTS idx_transfer_codes_user_id ON transfer_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_transfer_codes_expires_at ON transfer_codes(expires_at);

ALTER TABLE transfer_codes DISABLE ROW LEVEL SECURITY;

-- 期限切れコードの自動削除関数（cron で定期実行推奨）
CREATE OR REPLACE FUNCTION cleanup_expired_transfer_codes()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM transfer_codes WHERE expires_at < NOW();
END;
$$;
