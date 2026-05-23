# ZERO-PAIN マーケティング素材一式

App Store リリース後の集客に使う素材をまとめたディレクトリです。

## 📁 ディレクトリ構成

```
marketing/
├── README.md              ← このファイル
├── sns-posts.md           ← SNS投稿テンプレ集 (X / IG / FB / LINE / LinkedIn)
├── qr/                    ← QR コード PNG (透過なし)
│   ├── qr-app-store.png         ← App Store 直リンク (黒)
│   ├── qr-app-store-emerald.png ← App Store 直リンク (エメラルド)
│   ├── qr-lp.png                ← LP リンク (黒)
│   └── qr-lp-emerald.png        ← LP リンク (エメラルド)
└── print/                 ← 印刷用 HTML
    ├── business-card.html       ← 名刺 (A4 に 4 枚×表裏)
    └── store-pop-a4.html        ← 店舗 POP (A4 縦)
```

## 🔗 重要 URL

| 用途 | URL |
|---|---|
| **App Store** (直 DL) | https://apps.apple.com/jp/app/zero-pain/id6768903915 |
| **LP** (詳細紹介) | https://posture-app-steel.vercel.app/lp |

---

## 🖨️ 印刷方法

### 名刺 (business-card.html)

1. Finder で `marketing/print/business-card.html` をダブルクリック → ブラウザで開く
2. `⌘ + P` (Mac) / `Ctrl + P` (Win) で印刷ダイアログ
3. 設定:
   - 用紙: **A4 縦**
   - 余白: **標準**
   - 倍率: **100%**
   - 「**背景のグラフィック**」: **ON** (重要)
4. **2 ページ** 出力されます:
   - 1 ページ目: 表 ×4
   - 2 ページ目: 裏 ×4
5. **両面印刷** に設定 → A4 1 枚から名刺 4 枚分
6. 点線でカット (カッティングマシン推奨、なければハサミ)

**サイズ**: 91×55mm (日本の標準名刺サイズ)

### 店舗 POP (store-pop-a4.html)

1. Finder で `marketing/print/store-pop-a4.html` をダブルクリック → ブラウザで開く
2. `⌘ + P` / `Ctrl + P`
3. 設定:
   - 用紙: **A4 縦**
   - 余白: **なし** (大事: 「より少ない」or「カスタム余白 = 0」)
   - 「**背景のグラフィック**」: **ON**
4. **1 ページ** 出力
5. 厚紙にコピーして、L 字スタンドに挟むのがオススメ

**設置場所アイデア**:
- 整体院・接骨院の待合スペース
- カフェのレジ横
- ジムの掲示板
- 美容院の待合
- 自分のオフィス受付

---

## 🌐 SNS 投稿手順

### 基本フロー

1. `sns-posts.md` を開く
2. 投稿したいプラットフォーム × 用途の文面を選んでコピー
3. URL は必要に応じて差し替え (App Store URL or LP URL)
4. 画像を添付して投稿

### 添付画像のおすすめ

| 用途 | 画像 |
|---|---|
| リリース告知 | `posture-app/zero-pain-iap-screenshot.png` (App Store 「入手」スクショ) |
| 機能紹介 (X) | `posture-app/screenshots_v2/トップ画面.PNG` |
| 機能紹介 (IG カルーセル) | `posture-app/screenshots_v2/` の各画面 |
| 開発秘話 | `posture-app/public/icon-skeleton-sensei.png` (ガイコツ先生) |

---

## 📅 推奨ローンチプラン

### Day 1 (今日)
- [ ] **X**: A-1 リリース告知 + LP の Hero スクショ
- [ ] **Instagram**: B-1 リリース告知 + App Store 入手画面のスクショ
- [ ] **Facebook**: C-1 取引先・知人向けに丁寧めに
- [ ] **店舗 POP**: 自分のオフィス / 関連店舗に貼る

### Day 2
- [ ] **LINE**: D-1 (友人) / D-2 (取引先) で個別送信
- [ ] **名刺**: 印刷して持ち歩き開始

### Day 3 以降
- [ ] X: 機能紹介 / 共感型 / 7日間無料訴求を 1 日 1 投稿
- [ ] Instagram: 機能カルーセル投稿
- [ ] Facebook / LinkedIn: 開発秘話

### Week 2-4
- [ ] 整体院・カフェに POP 設置交渉
- [ ] 名刺は商談・初対面で必ず渡す
- [ ] X / IG で日々のセルフケア Tips を投稿し続けて存在感維持

---

## 💡 集客のコツ

### 1. 初動 DL 数を作る
- Apple のアルゴリズムは「**初動 DL 数**」を最重視
- 友人 10 人に「無料で試して」と頼むだけで検索順位が上がる
- QR コード経由は **「直近 DL = 関心の高いユーザー」** とみなされ、ランキングに有利

### 2. レビュー獲得
- 5 人くらい知人に **★ 5 レビュー + コメント** をお願いする
- レビュー 0 → 5 になるだけで信頼度が激変
- 「これ使ってみて、感想だけでも書いてくれると嬉しい」のお願いベース

### 3. 検索流入は遅れて来る
- 公開後 1-2 週間は検索ヒットが弱い
- それまでは **直リンク / QR コード経由が 9 割** と想定する
- 焦らず、LP と SNS で世界観を伝え続ける

### 4. ニッチで深く刺す
- 「肩こり」「腰痛」だと競合多数で埋もれる
- 「**デスクワーカーの肩こり**」「**スマホ首ケア**」みたいに絞る
- 投稿テーマも絞る → 反応が高い

---

## 🔄 QR コードを差し替えたい場合

URL を変更したり、別 URL の QR コードを作りたい時:

```bash
cd /Users/kobapro/Desktop/hp作成Antigravity/posture-app
python3 -c "
import qrcode
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.moduledrawers.pil import RoundedModuleDrawer
from qrcode.image.styles.colormasks import SolidFillColorMask

URL = 'ここに URL を入れる'
OUT = 'marketing/qr/qr-custom.png'

qr = qrcode.QRCode(version=None, error_correction=qrcode.constants.ERROR_CORRECT_H, box_size=20, border=2)
qr.add_data(URL)
qr.make(fit=True)
img = qr.make_image(image_factory=StyledPilImage, module_drawer=RoundedModuleDrawer(), color_mask=SolidFillColorMask(back_color=(255,255,255), front_color=(15,23,42)))
img.save(OUT)
print(f'Saved {OUT}')
"
```

---

## 📞 困った時

- 印刷で背景色が出ない → 「背景のグラフィック」を ON にする
- QR コードが読み取れない → 印刷サイズを大きくする (3cm 角以上推奨)
- 画像が表示されない → HTML ファイルを `marketing/print/` から動かさない (相対パス参照)

何か困ったらいつでも声かけてください。
