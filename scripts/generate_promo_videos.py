#!/usr/bin/env python3
"""
ZERO-PAIN プロモ動画ジェネレーター

各機能ごとに 15-20 秒の縦長プロモ動画 (1080x1920, 30fps) を生成する。
構成: タイトル → 機能訴求 → スクショ表示 → CTA

依存: PIL (Pillow), ffmpeg (システムインストール)
出力: marketing/videos/*.mp4
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

# === 設定 ===
W, H = 1080, 1920  # 9:16 縦長
FPS = 30
FRAMES_DIR = "marketing/videos/frames"
OUT_DIR = "marketing/videos"

JP_HEAVY = "/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc"
JP_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
JP_REG = "/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc"

# 各機能の動画設定
FEATURES = [
    {
        "id": "01-posture",
        "title": "AI 姿勢分析",
        "tagline": "全身写真からAIが\n骨格を自動分析",
        "screenshots": ["public/lp/02-capture.png", "public/lp/03-result.png"],
        "color": (16, 185, 129),  # emerald
        "bullets": [
            "全身ランドマーク検出",
            "左右差・歪みを数値化",
            "30秒で完了",
        ],
    },
    {
        "id": "02-sensei",
        "title": "ガイコツ先生 AI 相談",
        "tagline": "24時間いつでも\nAI が体の悩みに回答",
        "screenshots": ["public/lp/04-counsel.png"],
        "color": (236, 72, 153),  # pink
        "bullets": [
            "肩こり・腰痛 何でも相談",
            "あなたの姿勢データを反映",
            "深夜の不安にも即対応",
        ],
    },
    {
        "id": "03-meal",
        "title": "AI 食事分析",
        "tagline": "食事の写真1枚で\nAI が栄養を自動計算",
        "screenshots": ["public/lp/05-meal.png"],
        "color": (245, 158, 11),  # amber
        "bullets": [
            "写真撮るだけで栄養解析",
            "不足栄養素を AI が指摘",
            "厚労省基準準拠",
        ],
    },
    {
        "id": "04-coaching",
        "title": "30日コーチング",
        "tagline": "1ヶ月で習慣化\nセルフケアを継続",
        "screenshots": ["public/lp/06-coaching.png", "public/lp/07-streak.png"],
        "color": (139, 92, 246),  # violet
        "bullets": [
            "毎日のミッション提案",
            "連続記録で達成感",
            "無理なく続けられる",
        ],
    },
    {
        "id": "05-family",
        "title": "家族プラン",
        "tagline": "1契約で最大4人\n家族みんなで使える",
        "screenshots": ["public/lp/08-family.png"],
        "color": (59, 130, 246),  # blue
        "bullets": [
            "1契約 ¥1,980/月〜",
            "招待コードで簡単参加",
            "1人あたり ¥495 から",
        ],
    },
]


def make_gradient_bg(color_main):
    """グラデーション背景を生成"""
    img = Image.new("RGB", (W, H), (5, 23, 42))
    draw = ImageDraw.Draw(img)
    r1, g1, b1 = color_main
    # 上: 明るい主要色 → 下: ダーク
    for y in range(H):
        t = y / H
        r = int(r1 * (1 - t * 0.7))
        g = int(g1 * (1 - t * 0.7))
        b = int(b1 * (1 - t * 0.7))
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def add_glow(img):
    """ブラーグロー効果"""
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-200, -200, 500, 500), fill=(255, 255, 255, 60))
    gd.ellipse((W - 400, H - 400, W + 200, H + 200), fill=(255, 255, 255, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img.paste(glow, (0, 0), glow)
    return img


def draw_text_center(draw, text, y, font, fill, line_height_mul=1.2):
    """中央寄せでテキスト描画(複数行対応)"""
    lines = text.split("\n")
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        ly = y + i * int(font.size * line_height_mul)
        draw.text(((W - w) // 2, ly), line, fill=fill, font=font)


def generate_intro_frame(feature, progress):
    """0-2 秒: タイトル + ロゴ表示 (フェードイン)"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # スライドイン効果 (上から)
    offset_y = int((1 - min(progress * 2, 1)) * 100)
    alpha = int(min(progress * 2, 1) * 255)

    # オーバーレイで透明度演出
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)

    # 機能アイコンサークル (背景)
    cy = 600 + offset_y
    od.ellipse((W // 2 - 250, cy - 250, W // 2 + 250, cy + 250),
               fill=(255, 255, 255, alpha))

    img.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(img)

    # 機能番号
    f_num = ImageFont.truetype(JP_HEAVY, 200)
    num = feature["id"].split("-")[0]
    nw = draw.textlength(num, font=f_num)
    draw.text(((W - nw) // 2, cy - 150 + offset_y), num,
              fill=feature["color"], font=f_num)

    # タイトル
    f_title = ImageFont.truetype(JP_HEAVY, 100)
    title = feature["title"]
    tw = draw.textlength(title, font=f_title)
    draw.text(((W - tw) // 2, 1000 + offset_y), title,
              fill=(255, 255, 255), font=f_title)

    # タグライン
    f_tag = ImageFont.truetype(JP_BOLD, 56)
    draw_text_center(draw, feature["tagline"], 1180 + offset_y, f_tag,
                     (220, 220, 220))

    # ZERO-PAIN ブランド
    f_brand = ImageFont.truetype(JP_HEAVY, 60)
    draw.text((W - 380, H - 130), "ZERO-PAIN", fill=(255, 255, 255), font=f_brand)
    return img


def generate_screenshot_frame(feature, screenshot_idx, progress):
    """3-12 秒: スクショ + 訴求文 (スクショがスライドイン)"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # スクショ読み込み
    ss_path = feature["screenshots"][screenshot_idx]
    if os.path.exists(ss_path):
        ss = Image.open(ss_path).convert("RGBA")
        # 縦長スクショを大きく表示
        ss_h = 1200
        ratio = ss_h / ss.height
        ss_w = int(ss.width * ratio)
        ss = ss.resize((ss_w, ss_h), Image.LANCZOS)

        # iPhone モック風の角丸 + 影
        mock_w = ss_w + 30
        mock_h = ss_h + 30
        mock = Image.new("RGBA", (mock_w, mock_h), (0, 0, 0, 0))
        md = ImageDraw.Draw(mock)
        md.rounded_rectangle((0, 0, mock_w, mock_h), radius=60, fill=(15, 23, 42, 255))

        # ss を mock の中に貼る (角丸クロップ)
        ss_masked = Image.new("RGBA", (ss_w, ss_h), (0, 0, 0, 0))
        mask = Image.new("L", (ss_w, ss_h), 0)
        mdraw = ImageDraw.Draw(mask)
        mdraw.rounded_rectangle((0, 0, ss_w, ss_h), radius=50, fill=255)
        ss_masked.paste(ss, (0, 0), mask)
        mock.paste(ss_masked, (15, 15), ss_masked)

        # スライドイン (右から)
        slide_offset = int((1 - min(progress * 1.5, 1)) * 300)
        x = (W - mock_w) // 2 + slide_offset
        y = 600

        # 影
        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle((x + 20, y + 30, x + mock_w + 20, y + mock_h + 30),
                             radius=60, fill=(0, 0, 0, 120))
        shadow = shadow.filter(ImageFilter.GaussianBlur(30))
        img.paste(shadow, (0, 0), shadow)
        img.paste(mock, (x, y), mock)
        draw = ImageDraw.Draw(img)

    # タイトル (上)
    f_title = ImageFont.truetype(JP_HEAVY, 90)
    title = feature["title"]
    tw = draw.textlength(title, font=f_title)
    draw.text(((W - tw) // 2, 200), title, fill=(255, 255, 255), font=f_title)

    # 区切り
    bar_y = 320
    draw.rectangle((W // 2 - 80, bar_y, W // 2 + 80, bar_y + 8),
                   fill=feature["color"])

    # 機能特徴 (画面下部、フェードイン)
    f_bullet = ImageFont.truetype(JP_BOLD, 50)
    bullet_alpha = int(min(progress * 1.5, 1) * 255)
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for i, bullet in enumerate(feature["bullets"]):
        text = f"✓ {bullet}"
        bw = od.textlength(text, font=f_bullet)
        od.text(((W - bw) // 2, 1850 + i * 75), text,
                fill=(255, 255, 255, bullet_alpha), font=f_bullet)
    img.paste(overlay, (0, 0), overlay)
    return img


def generate_cta_frame(feature, progress):
    """最後 3 秒: CTA (今すぐダウンロード)"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # ガイコツ先生キャラ
    sensei_path = "public/icon-skeleton-sensei.png"
    if os.path.exists(sensei_path):
        sensei = Image.open(sensei_path).convert("RGBA")
        sensei_size = 500
        sensei = sensei.resize((sensei_size, sensei_size), Image.LANCZOS)
        # バウンス効果
        bounce_y = int(20 * abs((progress * 4) % 1 - 0.5))
        img.paste(sensei, ((W - sensei_size) // 2, 200 + bounce_y), sensei)
        draw = ImageDraw.Draw(img)

    # メインメッセージ
    f_msg = ImageFont.truetype(JP_HEAVY, 90)
    msg = "今すぐダウンロード!"
    mw = draw.textlength(msg, font=f_msg)
    draw.text(((W - mw) // 2, 850), msg, fill=(255, 255, 255), font=f_msg)

    # ZERO-PAIN
    f_brand = ImageFont.truetype(JP_HEAVY, 140)
    brand = "ZERO-PAIN"
    bw = draw.textlength(brand, font=f_brand)
    draw.text(((W - bw) // 2 + 6, 980 + 6), brand, fill=(0, 0, 0, 100), font=f_brand)
    draw.text(((W - bw) // 2, 980), brand, fill=(255, 255, 255), font=f_brand)

    # 7日間無料バッジ
    f_free = ImageFont.truetype(JP_HEAVY, 70)
    free = "7日間 完全無料"
    fw = draw.textlength(free, font=f_free)
    free_y = 1280
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle(
        ((W - fw) // 2 - 60, free_y - 30,
         (W + fw) // 2 + 60, free_y + 90 + 10),
        radius=60, fill=(15, 23, 42, 255)
    )
    img.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(img)
    draw.text(((W - fw) // 2, free_y), free, fill=(255, 235, 100), font=f_free)

    # CTA テキスト
    f_cta = ImageFont.truetype(JP_BOLD, 50)
    cta_lines = [
        "App Store で「ZERO-PAIN」",
        "今すぐ検索!",
    ]
    for i, line in enumerate(cta_lines):
        cw = draw.textlength(line, font=f_cta)
        draw.text(((W - cw) // 2, 1500 + i * 70), line,
                  fill=(255, 255, 255), font=f_cta)

    # URL
    f_url = ImageFont.truetype(JP_REG, 38)
    url = "apps.apple.com/jp/app/zero-pain"
    uw = draw.textlength(url, font=f_url)
    draw.text(((W - uw) // 2, 1720), url, fill=(255, 255, 200), font=f_url)

    return img


def generate_feature_video(feature):
    """1 つの機能の動画を生成"""
    fid = feature["id"]
    print(f"\n=== Generating {fid}: {feature['title']} ===")

    # フレームディレクトリをクリア
    frame_dir = f"{FRAMES_DIR}/{fid}"
    if os.path.exists(frame_dir):
        for f in os.listdir(frame_dir):
            os.remove(os.path.join(frame_dir, f))
    os.makedirs(frame_dir, exist_ok=True)

    # 動画構成:
    # 0-2 秒 (60 frames): イントロ
    # 2-4 秒 (60 frames): 静止イントロ
    # 4-9 秒 (150 frames): スクショ #1
    # 9-12 秒 (90 frames): スクショ #2 (なければ #1 続き)
    # 12-15 秒 (90 frames): CTA
    # 合計: 15 秒, 450 frames

    frame_idx = 0
    total_intro = 60
    total_intro_hold = 60
    total_ss1 = 150
    total_ss2 = 90
    total_cta = 90

    # Phase 1: イントロ (フェードイン)
    for i in range(total_intro):
        progress = i / total_intro
        img = generate_intro_frame(feature, progress)
        img.save(f"{frame_dir}/{frame_idx:04d}.png", optimize=True)
        frame_idx += 1
        if i % 20 == 0:
            print(f"  Intro: {i}/{total_intro}")

    # Phase 2: イントロ静止
    for i in range(total_intro_hold):
        img = generate_intro_frame(feature, 1.0)
        img.save(f"{frame_dir}/{frame_idx:04d}.png", optimize=True)
        frame_idx += 1

    # Phase 3: スクショ #1
    for i in range(total_ss1):
        progress = i / total_ss1
        img = generate_screenshot_frame(feature, 0, progress)
        img.save(f"{frame_dir}/{frame_idx:04d}.png", optimize=True)
        frame_idx += 1
        if i % 30 == 0:
            print(f"  SS1: {i}/{total_ss1}")

    # Phase 4: スクショ #2 (あれば)
    has_ss2 = len(feature["screenshots"]) > 1
    for i in range(total_ss2):
        progress = i / total_ss2
        ss_idx = 1 if has_ss2 else 0
        img = generate_screenshot_frame(feature, ss_idx, progress)
        img.save(f"{frame_dir}/{frame_idx:04d}.png", optimize=True)
        frame_idx += 1
        if i % 30 == 0:
            print(f"  SS2: {i}/{total_ss2}")

    # Phase 5: CTA
    for i in range(total_cta):
        progress = i / total_cta
        img = generate_cta_frame(feature, progress)
        img.save(f"{frame_dir}/{frame_idx:04d}.png", optimize=True)
        frame_idx += 1
        if i % 30 == 0:
            print(f"  CTA: {i}/{total_cta}")

    print(f"  Total frames: {frame_idx}")

    # ffmpeg で MP4 化
    out_path = f"{OUT_DIR}/{fid}-{feature['title'].replace(' ', '_')}.mp4"
    cmd = [
        "ffmpeg", "-y", "-framerate", str(FPS),
        "-i", f"{frame_dir}/%04d.png",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-crf", "20", "-preset", "fast",
        "-movflags", "+faststart",
        out_path
    ]
    print(f"  Encoding {out_path}...")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"  ❌ Error: {result.stderr[-500:]}")
        return None
    print(f"  ✅ Saved: {out_path}")
    # フレームクリーンアップ (容量節約)
    for f in os.listdir(frame_dir):
        os.remove(os.path.join(frame_dir, f))
    os.rmdir(frame_dir)
    return out_path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)

    print("ZERO-PAIN プロモ動画ジェネレーター")
    print(f"出力先: {OUT_DIR}/")
    print(f"機能数: {len(FEATURES)}")
    print()

    generated = []
    for feature in FEATURES:
        path = generate_feature_video(feature)
        if path:
            generated.append(path)

    print("\n=== 完了 ===")
    for p in generated:
        print(f"  ✓ {p}")
    print(f"\n合計 {len(generated)} 本の動画を生成")


if __name__ == "__main__":
    main()
