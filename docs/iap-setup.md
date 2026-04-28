# In-App Purchase 統合作業手順

ZERO-PAIN を App Store のサブスク商品として販売するための、Apple Developer & RevenueCat 側の設定手順。

コード側の準備は完了しています:
- `src/app/lib/iap.ts` ─ RevenueCat ラッパー
- `src/app/api/revenuecat/webhook/route.ts` ─ Webhook 受信
- `package.json` ─ `@revenuecat/purchases-capacitor` 依存追加済
- `supabase/migrations/subscriptions.sql` ─ revenuecat_app_user_id カラム既存

---

## 全体フロー

```
ユーザー [購入ボタン]
     ↓
  Capacitor アプリ
     ↓
  RevenueCat SDK
     ↓
  Apple StoreKit (Apple ID で決済)
     ↓
  Apple → RevenueCat に通知
     ↓
  RevenueCat → Webhook で /api/revenuecat/webhook を呼ぶ
     ↓
  Supabase subscriptions テーブル更新
     ↓
  アプリ側で プレミアム機能解放
```

---

## ステップ1: Apple Developer Program 加入

未加入の場合:
1. https://developer.apple.com/programs/ にアクセス
2. **Apple Developer Program** ($99/年) に登録
3. Apple ID で Sign in、有償契約

---

## ステップ2: App Store Connect でアプリ登録

1. https://appstoreconnect.apple.com/ にアクセス
2. **My Apps** → **+** → **New App**
3. 入力項目:
   - Platform: iOS
   - Name: **ZERO-PAIN**
   - Primary Language: Japanese
   - Bundle ID: **com.topbank.zeropain**（Identifiers から作成）
   - SKU: **zeropain_ios_001**
   - User Access: Full Access

---

## ステップ3: サブスク商品 (In-App Purchase) 登録

App Store Connect で:
1. アプリ詳細 → **Features** → **In-App Purchases** → **+** → **Auto-Renewable Subscription**

### Subscription Group 作成
- Reference Name: `ZERO-PAIN Premium`

### 商品①: 月額プラン
| 項目 | 値 |
|---|---|
| Reference Name | ZERO-PAIN Monthly Premium |
| Product ID | `zero_pain_monthly_1280` |
| Subscription Duration | 1 Month |
| Price (Japan) | ¥1,280 |
| Free Trial | 7 Days |
| Display Name (JP) | 月額プラン |
| Description (JP) | 全機能無制限。月額1,280円。7日間無料トライアル付き。 |

### 商品②: 年額プラン
| 項目 | 値 |
|---|---|
| Reference Name | ZERO-PAIN Yearly Premium |
| Product ID | `zero_pain_yearly_12800` |
| Subscription Duration | 1 Year |
| Price (Japan) | ¥12,800 |
| Free Trial | 7 Days |
| Display Name (JP) | 年額プラン（2ヶ月分お得） |
| Description (JP) | 全機能無制限。年額12,800円（月換算1,067円）。7日間無料トライアル付き。 |

両方とも **Localizations** を Japanese で必ず入力。

---

## ステップ4: App-Specific Shared Secret 取得

App Store Connect:
- アプリ詳細 → **App Information** → **App-Specific Shared Secret** → Generate
- 取得した英数字を控えておく（次ステップで使用）

---

## ステップ5: RevenueCat ダッシュボード設定

1. https://app.revenuecat.com/ で **Sign Up**（無料プラン: $10K/月収益まで無料）
2. **Create new project** → 名前 `ZERO-PAIN`
3. **Add an app** → iOS:
   - Bundle ID: `com.topbank.zeropain`
   - **App-Specific Shared Secret**: ステップ4で取得した値
4. 自動で iOS の API Key が発行される（次ステップで使用）

### Products 同期
- **Products** タブ → **Import**
- App Store Connect から `zero_pain_monthly_1280` と `zero_pain_yearly_12800` を import

### Entitlement 作成
- **Entitlements** → **+ New Entitlement**
- Identifier: `premium`
- 両方の商品を Attach

### Offering 作成
- **Offerings** → **+ New Offering**
- Identifier: `default`
- Packages として上記2商品を Add（`$rc_monthly` と `$rc_annual` のテンプレートを選ぶと楽）

### Webhook 設定
- **Project Settings** → **Integrations** → **Webhooks** → **Add**
- URL: `https://posture-app-steel.vercel.app/api/revenuecat/webhook`
- Authorization Header: `Bearer <ランダムな長い文字列>` （後で環境変数 `REVENUECAT_WEBHOOK_SECRET` に設定する値）

---

## ステップ6: 環境変数を Vercel に設定

Vercel ダッシュボード → posture-app → Settings → Environment Variables で以下を追加:

| 変数名 | 値 | 環境 |
|---|---|---|
| `NEXT_PUBLIC_REVENUECAT_IOS_KEY` | RevenueCat の iOS API Key | Production |
| `REVENUECAT_WEBHOOK_SECRET` | Webhook で設定したランダム文字列 | Production |

設定後、Vercel を再デプロイ（手動 Redeploy or 任意のコミット push）

---

## ステップ7: Capacitor iOS への反映

ターミナルで:
```bash
cd /Users/kobapro/Desktop/hp作成Antigravity/posture-app
npx cap sync ios
```

これで `@revenuecat/purchases-capacitor` の iOS ネイティブコードが ios/ 配下に反映される。

---

## ステップ8: Xcode で実機テスト

```bash
npx cap open ios
```

Xcode で:
1. Signing & Capabilities → Team を自分のアカウントに
2. Capabilities に **In-App Purchase** を追加
3. **Sandbox 用 Apple ID** で実機サインイン（App Store Connect → Users and Access → Sandbox）
4. ビルド → 実機で購入フロー確認

---

## ステップ9: 購入フロー UI を有効化

現状、サブスク画面はダミー実装。`lib/iap.ts` を使って差し替える必要あり:

```typescript
import { initIAP, getAvailablePackages, purchasePackage, restorePurchases, isNativeIOS } from '@/app/lib/iap';

// アプリ起動時に1回
useEffect(() => {
  initIAP(getDeviceId());
}, []);

// 購入ボタン
const handleBuy = async (pkg) => {
  const result = await purchasePackage(pkg);
  if (result.success) {
    alert('プレミアム会員になりました!');
  } else {
    alert(result.error);
  }
};

// 「購入の復元」ボタン (App Store ガイドライン必須)
const handleRestore = async () => {
  const result = await restorePurchases();
  if (result.isPremium) alert('プレミアムを復元しました');
};
```

実装は src/app/page.tsx の `subscription` Screen 内、または別ファイルとして書くと良い。

---

## ステップ10: TestFlight でβテスト

1. Xcode → **Product** → **Archive** → App Store Connect へ Upload
2. App Store Connect → **TestFlight** → Internal Testing でテスター追加
3. テスターが TestFlight アプリで購入確認（Sandbox では実課金なし）

---

## ステップ11: 本番審査提出

1. App Store Connect → **App Store** タブ → スクショ・説明文・キーワード等入力
2. **In-App Purchases** セクションで両プランを Submit に含める
3. **App Review Information** → 審査担当者向けメモ:
   ```
   サブスク購入は Apple Sandbox で正常動作することを TestFlight で確認済み。
   無料プランで姿勢チェック・AIチャット・食事チェックが各月数回まで利用可能。
   プレミアムでは全機能が無制限。
   ```
4. **Submit for Review**
5. 審査結果待ち（通常 1〜3 日）

---

## 想定される審査リジェクト要因と対策

| リジェクト理由 | 対策 |
|---|---|
| Restore Purchases ボタンがない | サブスク画面に必ず設置（コード雛形は対応済） |
| 自動更新の説明が不足 | サブスク画面に「自動更新されます。Apple ID から解約可能」と明記 |
| Privacy Policy が IAP の扱いに触れていない | privacy/page.tsx にサブスク決済情報の保管に関する記述追加 |
| Apple 以外の決済導線がある | Vercel 側 Web から決済リンクを完全削除（現状は OK） |
| 価格表示が実際と異なる | RevenueCat から動的に取得した価格を表示（雛形対応済） |

---

## 完了の目安

- 上記ステップ1〜11を順に実施: 慣れている人で 2〜3 日、初めてなら 1〜2 週間
- RevenueCat Webhook が正常動作するかは Supabase の subscriptions テーブルで確認
- 本番リリース後も月次で「サブスク継続率」「チャーン」を RevenueCat ダッシュボードで監視
