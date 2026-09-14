# App Store 審査提出メモ（2026-09-14 提出）

iOS 1.0.2 / build 9 を審査に提出した時の設定。次回の提出でも同じ手順が使える。

## 審査担当者向けアカウント

AI機能（姿勢チェック・チャット・食事分析）を 2026-09-13 に全面課金化したため、
何も用意しないと審査担当が中身を確認できず却下される。そのための仕組み。

| 項目 | 値 |
|---|---|
| 引き継ぎコード | `REVIEW26` |
| 有効期限 | 2027-12-31 |
| 再利用 | 可（reusable = true）|
| user_id | ec31e3e8-2af1-454a-abe8-bafd1b3e7daa |
| device_id | reviewer-apple-1789391362 |

仕組みは環境変数 `REVIEWER_USER_IDS`（Vercel production）に user_id を入れるだけ。
`getSubscriptionState` がこの ID を見て、応答を unlimited に差し替える。
DB は書き換えないので、**審査が終わったら環境変数から外すだけで元に戻る**。

判定はサーバー側のみ。`NEXT_PUBLIC_` を付けていないのでクライアントから偽装できない。

### 動作確認の方法

```bash
# 審査アカウント → unlimited になること
curl -s "https://posture-app-steel.vercel.app/api/subscription?deviceId=reviewer-apple-1789391362"

# 一般アカウント → limits が 0 のままであること
# （新しい deviceId で /api/register してから叩く）
```

2026-09-14 の実測では、審査アカウントが `"limits":{"posture":"unlimited",...}`、
一般アカウントが `"limits":{"posture":0,"chat":0,"meal":0}` で、区別が効いていた。

## サインイン情報のチェックは外す

このアプリはユーザー名とパスワードによるログインを持たない（端末IDで識別）。
「サインインが必要です」をオンにすると架空の ID とパスワードを書くことになるので、
**オフにして、メモ欄に引き継ぎコードの手順を書く**。

以前は所有者個人の Yahoo アドレスとパスワードがこの欄に入っていた。
アプリにログインが無い以上まったく機能しないうえ、個人の認証情報を
Apple に渡す形になっていたので、2026-09-14 に削除した。

## 提出時にひっかかった点

- **絵文字が使えない。** プロモーション用テキストに 🆕 を入れると
  「1つ以上の無効な文字が含まれています」で保存できない。
- **罫線「─」も使えない。** 説明文の区切りに使っていたら同じエラーになった。
  区切りが必要なら空行で代用する。
- **配信中バージョンの説明文は編集できない。** 新規バージョンを作らないと
  入力欄がロックされたままになる。プロモーション用テキストだけは例外で、
  審査なしでいつでも変更できる。

## ビルドの作り方（APIキー不要）

Xcode にサインイン済みなら、コマンドだけでアップロードまで完結する。

```bash
cd ios/App
xcodebuild -project App.xcodeproj -scheme App -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath /tmp/zp-archive/ZERO-PAIN.xcarchive \
  -allowProvisioningUpdates archive

# ExportOptions.plist の destination を "upload" にすると
# 書き出しと App Store Connect へのアップロードを一度にやってくれる
xcodebuild -exportArchive \
  -archivePath /tmp/zp-archive/ZERO-PAIN.xcarchive \
  -exportPath /tmp/zp-upload \
  -exportOptionsPlist /tmp/UploadOptions.plist \
  -allowProvisioningUpdates
```

App Store Connect API キーの発行は不要だった（発行にはアクセス権の
リクエストが要り、すぐには使えない）。

**注意**: Apple Developer Program の使用許諾契約が更新されていると
`No signing certificate "iOS Distribution" found` で書き出しが失敗する。
エラーの前に `PLA Update available` と出ていたらこれ。
Account Holder が https://developer.apple.com/account の
「契約を確認」から同意すれば直る。
