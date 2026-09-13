# ZERO-PAIN Android 版 リリース手順

> 2026-07-31 に Android プロジェクトを新規追加。iOS 1.0.1 と同じ Web(Vercel)を読み込む
> Capacitor 構成なので、**アプリ本体のロジックは iOS と共通**。Android 固有の作業だけをここにまとめる。

## 現在の到達点

| 項目 | 状態 |
|---|---|
| Android プロジェクト生成 (`npx cap add android`) | ✅ 完了 |
| デバッグ / リリースビルド | ✅ 成功 |
| 署名済み AAB 生成 | ✅ `android/app/build/outputs/bundle/release/app-release.aab` |
| アイコン・スプラッシュ | ✅ 全density生成済み (背景 #030712) |
| RevenueCat の Android 分岐 | ✅ コード実装済み(APIキー未設定のため実際の課金は未接続) |
| Google Play Console アカウント | ⬜ **法人で登録予定(誠さんの作業・最長のリードタイム)** |
| Play の定期購入商品 4つ | ⬜ アカウント開設後 |
| RevenueCat Android アプリ登録 | ⬜ 同上 |
| ストア掲載情報・データセーフティ | ⬜ |

## ビルド環境(このMacに導入済み)

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21     # brew install openjdk@21
export ANDROID_HOME="$HOME/Library/Android/sdk"   # brew install --cask android-commandlinetools
```

Android Studio は**未インストール**(GUIは不要。CLIだけでAABまで作れる)。

## ビルドコマンド

```bash
cd posture-app
npx cap sync android
cd android && ./gradlew bundleRelease     # → app/build/outputs/bundle/release/app-release.aab
./gradlew assembleDebug                   # 実機テスト用APK
```

## ⚠️ 署名鍵(最重要)

- 鍵: `android/zeropain-upload-key.jks` / 設定: `android/keystore.properties`
- **両方 .gitignore 済み**。リポジトリには入らない
- **この2ファイルを失うとアプリを更新できなくなる**。必ず別の場所(パスワードマネージャ / 外部ドライブ)にバックアップすること
- 証明書: CN=TOPBANK.INC, 有効期限 2053-12-16

## バージョン

`android/app/build.gradle` の `versionCode`(整数・提出のたびに+1) と `versionName`(表示用)。
現在 versionCode 1 / versionName "1.0.1"(iOSと揃えた)。

## 残作業の詳細

### 1. Google Play Console(法人アカウント)
- 登録料 $25(一回のみ)。**D-U-N-S 番号が必要**
- Apple の法人アカウント(Team ID 99GAMAUXKS / TopBank, Inc.)で既に取得済みのはずなので、同じ番号を流用できる
- 法人アカウントは「12人×14日間のクローズドテスト」要件が免除される(個人アカウントは必要)

### 2. 課金(RevenueCat + Google Play Billing)
1. Play Console →「定期購入」で iOS と同じ商品IDを作成
   `zero_pain_monthly_1280` / `zero_pain_yearly_12800` / `zero_pain_family_1980` / `zero_pain_family_19800`
2. Play Console → API アクセス → サービスアカウント作成 → JSON を RevenueCat にアップロード
3. RevenueCat → 既存の ZERO-PAIN プロジェクトに **Google Play アプリを追加**(Entitlement `premium` は iOS と共通のまま)
4. 発行された `goog_...` 公開キーを Vercel の環境変数へ:
   `NEXT_PUBLIC_REVENUECAT_ANDROID_KEY=goog_xxxxx`
   ※未設定のうちは `initIAP()` が安全に false を返し、課金UIが出ないだけで落ちない

### 3. 実機で要確認(Androidだけの挙動)
- [ ] **カメラ撮影**: 姿勢チェックは `<input type="file" capture="environment">`。Android WebView の
      ファイル選択がカメラを開けるか実機で確認。開けない場合は AndroidManifest に
      `android.permission.CAMERA` の追加が必要になる可能性
- [ ] 通知(食事リマインダー): Android 13+ は POST_NOTIFICATIONS の実行時許可。権限は自動マージ済み
- [ ] HealthKit 連携ボタンが Android で非表示になっているか(`healthkit.ts` で `getPlatform() !== "ios"` ガード済み)
- [ ] 課金画面の開示文が「Google アカウント / Google Play」表記になっているか

### 4. ストア掲載情報
- スクリーンショット: 電話 2〜8枚(16:9 or 9:16、最小 320px)
- **フィーチャーグラフィック 1024×500**(Play 必須・App Store には無い項目)
- アプリアイコン 512×512
- 短い説明(80字) / 詳細な説明(4000字) → `docs/app-store-metadata.md` の文言を流用可
- データセーフティ フォーム(収集するデータの申告。プライバシーポリシー: https://posture-app-steel.vercel.app/privacy)
