# ZERO-PAIN 英語化（全世界展開）計画

> 2026-08-29 着手。Android 製品版を審査に送信した直後から開始。

## 決定事項

| 項目 | 決定 |
|---|---|
| キャラクター英語名 | **Dr. Bones**（骨美→Bonnie / 骨太→Boney / コツリ→Kotsuri） |
| 今回の範囲 | アプリ本体 UI ＋ AI 応答（法務ページ・LP は次フェーズ） |
| 言語切替 | 端末言語で自動判定＋設定画面で手動上書き |
| 「カイロプラクター」 | **英語では絶対に chiropractor と言わせない**（米英加豪で国家資格名。無資格詐称は州により刑事罰） |

## 実測した作業量

| 対象 | 翻訳対象行数 |
|---|---|
| page.tsx | 944 |
| lib/stretches.ts | 330 |
| settings/page.tsx | 111 |
| lib/sensei-characters.ts | 65 |
| lib/postureAnalysis.ts | 59 |
| lib/chat-images.ts | 39 |
| lib/safe-language.ts | 28 |
| lib/healthkit.ts | 7 |
| **UI 小計** | **1,583** |
| API の AI プロンプト | 約 2,500 |

※ 当初 8,500 行と見積もったが、その大半（page.tsx だけで 502 行）はコメントで翻訳不要だった。

## 構成

```
src/app/lib/i18n/
  types.ts          Locale 型・定数
  locale.ts         端末言語の判定 / localStorage への保存
  index.tsx         LocaleProvider・useT()・translate()
  dictionaries/
    ja.ts           日本語辞書
    en.ts           英語辞書
```

- 英語が未翻訳のキーは**日本語にフォールバック**し、開発時のみ console に警告。空欄にはしない。
- `<html lang>` を実言語に追従させる。日本語の禁則処理はこれが無いと壊れる（既知の落とし穴）。
- ハイドレーション不一致を避けるため、初期値は ja、マウント後に実言語へ切替。

## 進捗

- [x] i18n 基盤（types / locale / provider / useT）
- [x] 抽出スクリプト `scripts/extract-i18n.mjs`
- [x] stretches.ts の構造化抽出（30件・手順180ステップ）
- [ ] stretches の英語データ作成
- [ ] page.tsx の文言差し替え
- [ ] settings/page.tsx（言語切替UIを追加）
- [ ] sensei-characters の英語ペルソナ（chiropractor 排除）
- [ ] API プロンプトの英語版
- [ ] 実機確認

## 次フェーズ（今回対象外）

- privacy / terms / LP の英語化
- Google Play の海外価格設定（現在は日本のみ）
- App Store の英語掲載情報
- **iOS 掲載文の誤り修正**：写真が「第三者と共有されません」とあるが、実際は Anthropic / OpenAI に送信している
