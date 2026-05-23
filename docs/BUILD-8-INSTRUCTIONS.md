# Build 8 ビルド & 申請手順

ZERO-PAIN v1.0.0 Build 8 (HealthKit 正式連携 + viewport ズーム解禁) を
App Store に再提出するための手順。

## 📝 修正内容サマリ (Build 8 で何が変わるか)

1. **viewport ズーム解禁** (アクセシビリティ向上)
   - 2 本指ピンチで画面拡大できるようになる
   - `src/app/layout.tsx` の `maximumScale` / `userScalable` を変更

2. **HealthKit プラグインを SPM に正式統合**
   - `node_modules/@perfood/capacitor-healthkit/Package.swift` を新規追加
   - `patches/perfood-capacitor-healthkit-Package.swift` にバックアップ
   - `scripts/postinstall-healthkit.sh` で npm install 後に自動復元

3. **App.entitlements を作成して HealthKit Entitlement を追加**
   - `ios/App/App/App.entitlements` を新規追加
   - `com.apple.developer.healthkit` = true

4. **Xcode project.pbxproj 更新**
   - `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` を Debug/Release 両方に追加
   - `CURRENT_PROJECT_VERSION = 7` → `8`
   - App PBXGroup に App.entitlements を File Reference として登録

---

## 🚀 ビルド手順

### Step 1: Xcode で HealthKit Capability を追加 (1 回だけ必要)

これは手動でしかできない部分です。

1. Xcode で `ios/App/App.xcworkspace` を開く
   ```bash
   open ios/App/App.xcworkspace
   ```
   (もし `.xcworkspace` がなければ `ios/App/App.xcodeproj`)

2. 左パネルで **App** プロジェクト → **App** ターゲット を選択
3. 上タブ **Signing & Capabilities** をクリック
4. 左上の **+ Capability** ボタンをクリック
5. 検索欄に **HealthKit** と入力
6. **HealthKit** をダブルクリックで追加
7. 追加された **HealthKit** セクションで:
   - `Clinical Health Records` は **チェック不要**(オフのまま OK)
   - `Background Delivery` も **チェック不要**(現状不要)

これで Xcode が App.entitlements を認識し、Provisioning Profile に
HealthKit が含まれるようになります。

### Step 2: クリーンビルド

Xcode で:
1. メニュー: **Product** → **Clean Build Folder** (`⇧⌘K`)
2. メニュー: **Product** → **Build** (`⌘B`)

エラーが出なければ OK。
よくあるエラー:
- `No matching profile found` → Signing & Capabilities で Team を再選択
- `Missing entitlement` → Step 1 の HealthKit Capability 追加を確認

### Step 3: 実機テスト

ビルドできたら、自分の iPhone で実機テスト:
1. iPhone を USB 接続
2. Xcode 左上のデバイス選択でデバイス選択 (Simulator ではダメ)
3. `⌘R` で実機にインストール起動
4. **設定 → Apple HealthKit 連携**を開く
5. **続ける** ボタンをタップ
6. iOS の許可ダイアログが出れば成功 ✅
   - 「アクセスを許可する」をタップ
7. アプリに戻ると「ヘルスケアと連携しました」のメッセージ表示
8. 歩数等が表示される

もし許可ダイアログが出ない場合:
- Xcode コンソールでエラーメッセージ確認
- iPhone の Settings → ZERO-PAIN → アプリ権限を確認

### Step 4: Archive

実機テストで動作確認できたら、Archive ビルドを作成:

1. Xcode 左上のターゲット選択を **Any iOS Device (arm64)** に変更
2. メニュー: **Product** → **Archive**
3. ビルド完了を待つ (3-5 分)
4. Organizer ウィンドウが自動で開く

### Step 5: App Store Connect にアップロード

Organizer ウィンドウで:
1. 最新の Archive (Build 8) を選択
2. **Distribute App** をクリック
3. **App Store Connect** を選択 → **Next**
4. **Upload** を選択 → **Next**
5. **Automatically manage signing** で OK → **Next**
6. Review 画面で確認 → **Upload**
7. アップロード完了まで待つ (5-10 分)

### Step 6: App Store Connect で Build 8 を割り当て

1. https://appstoreconnect.apple.com/ にログイン
2. My Apps → ZERO-PAIN
3. App Store タブ → 「1.0.0」または「1.0.1 を準備」(後述)

#### 選択肢 A: バージョン 1.0.0 のまま (Build 8 をその差し替え)

すでに 1.0.0 がリリース済みなので、これは原則できない。
新しいバージョン番号 (1.0.1) を作成する必要あり。

#### 選択肢 B (推奨): バージョン 1.0.1 を新規作成

1. App Store タブ左の **+ バージョン**
2. バージョン: `1.0.1`
3. 「このバージョンに関する新機能」:
   ```
   - Apple HealthKit との連携を有効化しました
   - 2 本指でのピンチズーム操作に対応しました
   - 細かな UI 改善
   ```
4. Build セクションで **Build 8** を選択
5. 「自動でリリースする」設定
6. **審査用に追加** → **提出する**

### Step 7: マーケティングバージョンも上げる

新バージョン 1.0.1 にする場合、`project.pbxproj` の MARKETING_VERSION
も更新しておくと整合します。

```
MARKETING_VERSION = 1.0.0; → MARKETING_VERSION = 1.0.1;
```

両方の Configuration (Debug/Release) で更新。

---

## ⚠️ 想定されるリスクと対策

### リスク 1: Provisioning Profile の更新が必要

HealthKit Capability を追加すると、Apple Developer で
Provisioning Profile を再生成する必要があります。

Xcode の **Automatically manage signing** が ON ならほぼ自動で処理されますが、
うまくいかない場合:

1. Xcode → Settings → Accounts → 自分の Apple ID
2. **Manage Certificates** → 確認
3. Signing & Capabilities タブで **Try Again** をクリック

### リスク 2: HealthKit プラグインの SPM 統合が不完全

`@perfood/capacitor-healthkit` は元々 CocoaPods 用なので、
SPM ビルド時に Objective-C ヘッダー解決のエラーが出る可能性。

エラー例:
- `Module 'Capacitor' not found`
- `Header 'CapacitorHealthkitPlugin.h' not found`

対処:
- `node_modules/@perfood/capacitor-healthkit/Package.swift` の `publicHeadersPath` を調整
- 必要なら custom modulemap 追加

### リスク 3: 審査リジェクト

App Store の審査で何か言われる可能性:

- **HealthKit データ使用目的**: Info.plist の `NSHealthShareUsageDescription` で説明済み
- **データ送信先**: Privacy Policy に「データは外部送信されない」と明記済み
- **必要最小限の権限**: 歩数・体重・心拍・カロリーのみ要求

これらは既に対応済みなので、リジェクト確率は低い見込み。

### リスク 4: npm install で Package.swift が消える

→ `postinstall` script で自動復元するようにしました。
   再現性のため `patches/` にバックアップを置いています。

---

## 📋 チェックリスト

ビルド開始前にこれらをチェック:

- [ ] `App.entitlements` ファイルが存在する (`ios/App/App/App.entitlements`)
- [ ] `project.pbxproj` に `CODE_SIGN_ENTITLEMENTS = App/App.entitlements` が両 Configuration にある
- [ ] `project.pbxproj` の `CURRENT_PROJECT_VERSION = 8`
- [ ] `node_modules/@perfood/capacitor-healthkit/Package.swift` が存在する
- [ ] `ios/App/CapApp-SPM/Package.swift` に `PerfoodCapacitorHealthkit` が含まれている
- [ ] `npx cap sync ios` がエラーなく完了する
- [ ] Xcode で **HealthKit Capability** を追加した

審査提出前にこれらをチェック:

- [ ] 実機 (Simulator ではダメ) で「設定 → HealthKit 続ける」が動作する
- [ ] iOS の許可ダイアログが表示される
- [ ] 許可後にデータ (歩数等) が取得・表示される
- [ ] Build 8 が ASC にアップロード成功
- [ ] バージョン 1.0.1 を作成して Build 8 を紐付け
- [ ] リリースノート記入済
- [ ] 「審査用に追加」→「提出する」をクリック

---

## 🔄 これ以降のバージョンでの開発フロー

このセットアップ完了後、次回以降のバージョンアップ (v1.1, v1.2 等) では:

1. コード変更 → commit → push
2. `MARKETING_VERSION` と `CURRENT_PROJECT_VERSION` を更新
3. `npx cap sync ios`
4. Xcode で Archive
5. ASC にアップロード
6. 新バージョンを作成して Build を紐付け
7. 提出

HealthKit 関連の Xcode 設定は **Step 1 を 1 度やれば永続化** されます。
