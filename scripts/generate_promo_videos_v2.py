#!/usr/bin/env python3
"""
ZERO-PAIN プロモ動画 v2: ストーリー構成版

各機能ごとに 25 秒の縦長プロモ動画 (1080x1920, 30fps) を生成。

構成 (5 シーン):
  0-3s   : Hook (問いかけ)
  3-8s   : 悩み提示
  8-13s  : 解決策 + スクショ
  13-19s : 使い方 3 ステップ
  19-23s : 効果・結果
  23-25s : CTA
"""

import os
import subprocess
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1080, 1920
FPS = 30
FRAMES_DIR = "marketing/videos/frames"
OUT_DIR = "marketing/videos"

JP_HEAVY = "/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc"
JP_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W7.ttc"
JP_REG = "/System/Library/Fonts/ヒラギノ角ゴシック W5.ttc"

# 機能定義 (ストーリー構成)
FEATURES = [
    {
        "id": "01-posture",
        "title": "AI 姿勢分析",
        "color": (16, 185, 129),  # emerald
        "hook": "あなたの姿勢、\n本当に正しい?",
        "problem": [
            "鏡を見ても気付かない",
            "肩・骨盤・膝の歪み",
            "歪みを数値で知りたい",
        ],
        "solution_title": "AIが骨格を自動分析",
        "solution_desc": "全身写真2枚で、\nAIが歪みを可視化",
        "steps": [
            ("1", "正面を撮影", "両手を下ろして真っ直ぐ立つだけ"),
            ("2", "横向きも撮影", "10秒で完了"),
            ("3", "AIが分析", "肩・骨盤・膝の角度を数値化"),
        ],
        "benefits": [
            "整体に行かなくても自分の状態が分かる",
            "改善の進捗も数値で確認",
            "改善ストレッチを自動提案",
        ],
        "screenshots": ["public/lp/02-capture.png", "public/lp/03-result.png"],
    },
    {
        "id": "02-sensei",
        "title": "ガイコツ先生 AI 相談",
        "color": (236, 72, 153),  # pink
        "hook": "深夜の肩こり、\n誰に相談する?",
        "problem": [
            "整体に行く時間がない",
            "家族にも言いづらい",
            "気軽に相談したい",
        ],
        "solution_title": "24時間 AIが回答",
        "solution_desc": "ガイコツ先生が\nいつでも親身に相談",
        "steps": [
            ("1", "症状を伝える", "「朝起きると肩が痛い」など"),
            ("2", "AIが分析", "あなたの姿勢データも反映"),
            ("3", "アドバイス", "原因とセルフケア法を提案"),
        ],
        "benefits": [
            "深夜の不安にも即対応",
            "整体院の待ち時間ゼロ",
            "あなただけの専属コーチ",
        ],
        "screenshots": ["public/lp/04-counsel.png"],
    },
    {
        "id": "03-meal",
        "title": "AI 食事分析",
        "color": (245, 158, 11),  # amber
        "hook": "毎日の食事、\n栄養取れてる?",
        "problem": [
            "カロリー計算が面倒",
            "栄養素なんて分からない",
            "姿勢と栄養の関係を知りたい",
        ],
        "solution_title": "写真1枚で栄養解析",
        "solution_desc": "食事を撮るだけで\nAIが自動分析",
        "steps": [
            ("1", "食事を撮影", "スマホで1枚パシャリ"),
            ("2", "AIが解析", "メニュー・カロリー・栄養素を判定"),
            ("3", "不足を提案", "あなたに足りない栄養を教える"),
        ],
        "benefits": [
            "厚労省「食事摂取基準」準拠",
            "姿勢改善に必要な栄養が分かる",
            "家族の食事管理にも",
        ],
        "screenshots": ["public/lp/05-meal.png"],
    },
    {
        "id": "04-coaching",
        "title": "30日コーチング",
        "color": (139, 92, 246),  # violet
        "hook": "1人で続けるの、\n難しくない?",
        "problem": [
            "ストレッチも3日坊主",
            "効果が見えず諦める",
            "続ける仕組みが欲しい",
        ],
        "solution_title": "毎日のミッション",
        "solution_desc": "AIが30日間\n伴走してくれる",
        "steps": [
            ("1", "毎朝ミッション", "今日やるストレッチが届く"),
            ("2", "達成チェック", "完了したらタップ"),
            ("3", "連続記録", "炎マークで習慣を可視化"),
        ],
        "benefits": [
            "30日で姿勢ケアを習慣に",
            "連続記録で達成感",
            "無理なく続けられる仕組み",
        ],
        "screenshots": ["public/lp/06-coaching.png", "public/lp/07-streak.png"],
    },
    {
        "id": "05-family",
        "title": "家族プラン",
        "color": (59, 130, 246),  # blue
        "hook": "家族みんなで\n健康になりたい?",
        "problem": [
            "1人ずつ契約は高い",
            "家族の健康も気になる",
            "親に勧めても続かない",
        ],
        "solution_title": "1契約で最大4人",
        "solution_desc": "家族みんなで\nセルフケアを共有",
        "steps": [
            ("1", "家族プラン契約", "月額¥1,980 / 年額¥19,800"),
            ("2", "招待コード発行", "ワンタップで生成"),
            ("3", "家族に共有", "コード入力で参加完了"),
        ],
        "benefits": [
            "1人あたり ¥495 / 月から",
            "個別データは家族内でも非公開",
            "親・子供・配偶者みんなで",
        ],
        "screenshots": ["public/lp/08-family.png"],
    },
]


def make_gradient_bg(color_main):
    img = Image.new("RGB", (W, H), (5, 23, 42))
    draw = ImageDraw.Draw(img)
    r1, g1, b1 = color_main
    for y in range(H):
        t = y / H
        r = int(r1 * (1 - t * 0.7))
        g = int(g1 * (1 - t * 0.7))
        b = int(b1 * (1 - t * 0.7))
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    return img


def add_glow(img):
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((-200, -200, 500, 500), fill=(255, 255, 255, 60))
    gd.ellipse((W - 400, H - 400, W + 200, H + 200), fill=(255, 255, 255, 50))
    glow = glow.filter(ImageFilter.GaussianBlur(80))
    img.paste(glow, (0, 0), glow)
    return img


def draw_text_center(draw, text, y, font, fill, line_height_mul=1.2):
    lines = text.split("\n")
    for i, line in enumerate(lines):
        w = draw.textlength(line, font=font)
        ly = y + i * int(font.size * line_height_mul)
        draw.text(((W - w) // 2, ly), line, fill=fill, font=font)


def draw_text_center_alpha(img, text, y, font, fill, alpha, line_height_mul=1.2):
    """透明度付きでテキスト描画"""
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    lines = text.split("\n")
    for i, line in enumerate(lines):
        w = od.textlength(line, font=font)
        ly = y + i * int(font.size * line_height_mul)
        od.text(((W - w) // 2, ly), line,
                fill=(*fill, alpha) if len(fill) == 3 else fill, font=font)
    img.paste(overlay, (0, 0), overlay)


def add_brand_footer(img, color):
    """画面下部にブランド表示"""
    draw = ImageDraw.Draw(img)
    f_brand = ImageFont.truetype(JP_HEAVY, 42)
    bw = draw.textlength("ZERO-PAIN", font=f_brand)
    draw.text(((W - bw) // 2, H - 100), "ZERO-PAIN",
              fill=(255, 255, 255, 200), font=f_brand)


def gen_hook(feature, progress):
    """Scene 1 (0-3s): Hook - 大きな問いかけ"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # フェードイン + スケール
    scale = 0.5 + min(progress * 2, 1) * 0.5
    alpha = int(min(progress * 1.5, 1) * 255)

    f_hook = ImageFont.truetype(JP_HEAVY, int(110 * scale))
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    hook = feature["hook"]
    lines = hook.split("\n")
    base_y = H // 2 - (len(lines) * int(f_hook.size * 1.1)) // 2
    for i, line in enumerate(lines):
        w = od.textlength(line, font=f_hook)
        ly = base_y + i * int(f_hook.size * 1.1)
        # 大きな影
        od.text(((W - w) // 2 + 6, ly + 6), line,
                fill=(0, 0, 0, alpha // 2), font=f_hook)
        od.text(((W - w) // 2, ly), line, fill=(255, 255, 255, alpha), font=f_hook)
    img.paste(overlay, (0, 0), overlay)

    add_brand_footer(img, feature["color"])
    return img


def gen_problem(feature, progress):
    """Scene 2 (3-8s): 悩み提示 - 共感ポイント 3 つ"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # ヘッダー
    f_h = ImageFont.truetype(JP_HEAVY, 70)
    h = "こんな悩み、ありませんか?"
    hw = draw.textlength(h, font=f_h)
    draw.text(((W - hw) // 2, 250), h, fill=(255, 255, 255), font=f_h)

    # 線
    bar_y = 360
    draw.rectangle((W // 2 - 80, bar_y, W // 2 + 80, bar_y + 8),
                   fill=(255, 255, 255))

    # 悩み 3 つ (順次フェードイン)
    f_p = ImageFont.truetype(JP_BOLD, 60)
    for i, prob in enumerate(feature["problem"]):
        # i 番目は progress > i/3 で表示
        item_progress = max(0, min((progress * 3 - i), 1))
        if item_progress <= 0:
            continue
        alpha = int(item_progress * 255)

        # チェックマーク背景
        cy = 600 + i * 240
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.rounded_rectangle((100, cy, W - 100, cy + 180),
                              radius=40, fill=(255, 255, 255, int(40 * item_progress)))

        # NG バッジ (赤い角丸 + テキスト)
        od.rounded_rectangle((140, cy + 55, 260, cy + 135),
                              radius=18, fill=(220, 60, 60, alpha))
        nf = ImageFont.truetype(JP_HEAVY, 56)
        nw = od.textlength("NG", font=nf)
        od.text((140 + (120 - nw) // 2, cy + 65), "NG",
                fill=(255, 255, 255, alpha), font=nf)

        # 悩み文
        od.text((300, cy + 65), prob, fill=(255, 255, 255, alpha), font=f_p)
        img.paste(overlay, (0, 0), overlay)

    add_brand_footer(img, feature["color"])
    return img


def gen_solution(feature, progress):
    """Scene 3 (8-13s): 解決策 + スクショ (v3: シンプル化)"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # 上部: 半透明ピル形ヘッダー (白カード廃止)
    f_label = ImageFont.truetype(JP_HEAVY, 38)
    label = "ZERO-PAIN なら解決!"
    lw = draw.textlength(label, font=f_label)
    pill_y = 200
    pill_h = 80
    pill_x1 = (W - lw) // 2 - 90
    pill_x2 = (W + lw) // 2 + 40
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.rounded_rectangle((pill_x1, pill_y, pill_x2, pill_y + pill_h),
                         radius=40, fill=(255, 255, 255, 250))
    # チェックマーク (V 字を線で描画)
    cx = pill_x1 + 45
    cy = pill_y + pill_h // 2
    # 緑円
    od.ellipse((cx - 24, cy - 24, cx + 24, cy + 24),
               fill=(*feature["color"], 255))
    # チェック (白い線、V 字)
    check_pts = [(cx - 11, cy + 1), (cx - 3, cy + 9), (cx + 12, cy - 8)]
    od.line(check_pts, fill=(255, 255, 255), width=6, joint="curve")
    img.paste(overlay, (0, 0), overlay)
    draw = ImageDraw.Draw(img)

    # ピル内テキスト
    draw.text((pill_x1 + 85, pill_y + 16), label,
              fill=(15, 23, 42), font=f_label)

    # ソリューションタイトル (大、中央、ピル下)
    f_st = ImageFont.truetype(JP_HEAVY, 80)
    st = feature["solution_title"]
    stw = draw.textlength(st, font=f_st)
    # 影付き
    draw.text(((W - stw) // 2 + 5, 340 + 5), st,
              fill=(0, 0, 0, 80), font=f_st)
    draw.text(((W - stw) // 2, 340), st, fill=(255, 255, 255), font=f_st)

    # スクショ (右からスライドイン)
    ss_path = feature["screenshots"][0]
    if os.path.exists(ss_path):
        ss = Image.open(ss_path).convert("RGBA")
        ss_h = 1100
        ratio = ss_h / ss.height
        ss_w = int(ss.width * ratio)
        ss = ss.resize((ss_w, ss_h), Image.LANCZOS)

        mock_w = ss_w + 30
        mock_h = ss_h + 30
        mock = Image.new("RGBA", (mock_w, mock_h), (0, 0, 0, 0))
        md = ImageDraw.Draw(mock)
        md.rounded_rectangle((0, 0, mock_w, mock_h), radius=60,
                             fill=(15, 23, 42, 255))

        ss_masked = Image.new("RGBA", (ss_w, ss_h), (0, 0, 0, 0))
        mask = Image.new("L", (ss_w, ss_h), 0)
        mdraw = ImageDraw.Draw(mask)
        mdraw.rounded_rectangle((0, 0, ss_w, ss_h), radius=50, fill=255)
        ss_masked.paste(ss, (0, 0), mask)
        mock.paste(ss_masked, (15, 15), ss_masked)

        slide_offset = int((1 - min(progress * 1.5, 1)) * 300)
        x = (W - mock_w) // 2 + slide_offset
        y = 480

        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle((x + 20, y + 30, x + mock_w + 20, y + mock_h + 30),
                             radius=60, fill=(0, 0, 0, 120))
        shadow = shadow.filter(ImageFilter.GaussianBlur(30))
        img.paste(shadow, (0, 0), shadow)
        img.paste(mock, (x, y), mock)

    add_brand_footer(img, feature["color"])
    return img


def gen_steps(feature, progress):
    """Scene 4 (13-19s): 使い方 3 ステップ"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # ヘッダー
    f_h = ImageFont.truetype(JP_HEAVY, 70)
    h = "使い方は超かんたん"
    hw = draw.textlength(h, font=f_h)
    draw.text(((W - hw) // 2, 250), h, fill=(255, 255, 255), font=f_h)

    bar_y = 360
    draw.rectangle((W // 2 - 80, bar_y, W // 2 + 80, bar_y + 8),
                   fill=(255, 255, 255))

    # 3 ステップ (順次フェードイン) - v3 でフォントサイズ調整
    f_num = ImageFont.truetype(JP_HEAVY, 110)
    f_title = ImageFont.truetype(JP_HEAVY, 52)
    f_desc = ImageFont.truetype(JP_REG, 34)

    for i, (num, title, desc) in enumerate(feature["steps"]):
        item_progress = max(0, min((progress * 3 - i), 1))
        if item_progress <= 0:
            continue
        alpha = int(item_progress * 255)

        cy = 530 + i * 360
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)

        # 番号サークル (少し小さく、左マージン保ったまま)
        circle_x = 100
        circle_size = 160
        od.ellipse((circle_x, cy + 35, circle_x + circle_size, cy + 35 + circle_size),
                   fill=(255, 255, 255, alpha))
        # 番号
        nw = od.textlength(num, font=f_num)
        od.text((circle_x + (circle_size - nw) // 2, cy + 55), num,
                fill=(*feature["color"], alpha), font=f_num)

        # タイトル (左マージン拡大、右安全)
        text_x = 300
        od.text((text_x, cy + 55), title, fill=(255, 255, 255, alpha), font=f_title)
        # 説明
        od.text((text_x, cy + 130), desc, fill=(220, 220, 220, alpha), font=f_desc)

        img.paste(overlay, (0, 0), overlay)

    add_brand_footer(img, feature["color"])
    return img


def gen_benefit(feature, progress):
    """Scene 5 (19-23s): 効果"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # ヘッダー
    f_h = ImageFont.truetype(JP_HEAVY, 70)
    h = "あなたが手に入れるもの"
    hw = draw.textlength(h, font=f_h)
    draw.text(((W - hw) // 2, 250), h, fill=(255, 255, 255), font=f_h)

    bar_y = 360
    draw.rectangle((W // 2 - 80, bar_y, W // 2 + 80, bar_y + 8),
                   fill=(255, 235, 100))

    # スクショ #2 (あれば、右下に小さく配置)
    has_ss2 = len(feature["screenshots"]) > 1
    ss_path = feature["screenshots"][1 if has_ss2 else 0]
    if os.path.exists(ss_path):
        ss = Image.open(ss_path).convert("RGBA")
        ss_h = 700
        ratio = ss_h / ss.height
        ss_w = int(ss.width * ratio)
        ss = ss.resize((ss_w, ss_h), Image.LANCZOS)
        x = (W - ss_w) // 2
        y = 480

        # 角丸クロップ
        mask = Image.new("L", (ss_w, ss_h), 0)
        mdraw = ImageDraw.Draw(mask)
        mdraw.rounded_rectangle((0, 0, ss_w, ss_h), radius=40, fill=255)
        ss_masked = Image.new("RGBA", (ss_w, ss_h), (0, 0, 0, 0))
        ss_masked.paste(ss, (0, 0), mask)

        shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(shadow)
        sd.rounded_rectangle((x + 10, y + 20, x + ss_w + 10, y + ss_h + 20),
                             radius=40, fill=(0, 0, 0, 100))
        shadow = shadow.filter(ImageFilter.GaussianBlur(25))
        img.paste(shadow, (0, 0), shadow)
        img.paste(ss_masked, (x, y), ss_masked)

    # 効果リスト (順次) - v3 でフォント縮小 + 余白調整
    f_b = ImageFont.truetype(JP_BOLD, 38)
    for i, bn in enumerate(feature["benefits"]):
        item_progress = max(0, min((progress * 3 - i * 0.5), 1))
        if item_progress <= 0:
            continue
        alpha = int(item_progress * 255)

        cy = 1290 + i * 95
        overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        # 星マーク (多角形で描画、絵文字非依存)
        sx, sy, ss = 110, cy + 22, 20
        star_points = []
        import math
        for k in range(10):
            angle = math.pi / 2 + k * math.pi / 5
            r = ss if k % 2 == 0 else ss * 0.45
            star_points.append((sx + r * math.cos(angle), sy - r * math.sin(angle)))
        od.polygon(star_points, fill=(255, 235, 100, alpha))
        od.text((160, cy + 5), bn, fill=(255, 255, 255, alpha), font=f_b)
        img.paste(overlay, (0, 0), overlay)

    add_brand_footer(img, feature["color"])
    return img


def gen_cta(feature, progress):
    """Scene 6 (23-25s): CTA"""
    img = make_gradient_bg(feature["color"])
    img = add_glow(img)
    draw = ImageDraw.Draw(img)

    # ガイコツ先生 (バウンス)
    sensei_path = "public/icon-skeleton-sensei.png"
    if os.path.exists(sensei_path):
        sensei = Image.open(sensei_path).convert("RGBA")
        sensei_size = 500
        sensei = sensei.resize((sensei_size, sensei_size), Image.LANCZOS)
        bounce_y = int(20 * abs((progress * 4) % 1 - 0.5))
        img.paste(sensei, ((W - sensei_size) // 2, 250 + bounce_y), sensei)
        draw = ImageDraw.Draw(img)

    # ZERO-PAIN
    f_brand = ImageFont.truetype(JP_HEAVY, 140)
    brand = "ZERO-PAIN"
    bw = draw.textlength(brand, font=f_brand)
    draw.text(((W - bw) // 2 + 6, 880 + 6), brand, fill=(0, 0, 0, 100),
              font=f_brand)
    draw.text(((W - bw) // 2, 880), brand, fill=(255, 255, 255), font=f_brand)

    # 7日間無料
    f_free = ImageFont.truetype(JP_HEAVY, 70)
    free = "7日間 完全無料"
    fw = draw.textlength(free, font=f_free)
    free_y = 1130
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

    # CTA
    f_cta = ImageFont.truetype(JP_HEAVY, 60)
    cta_lines = ["今すぐダウンロード!", "App Storeで「ZERO-PAIN」"]
    for i, line in enumerate(cta_lines):
        cw = draw.textlength(line, font=f_cta)
        draw.text(((W - cw) // 2, 1380 + i * 80), line,
                  fill=(255, 255, 255), font=f_cta)

    # URL
    f_url = ImageFont.truetype(JP_REG, 38)
    url = "apps.apple.com/jp/app/zero-pain"
    uw = draw.textlength(url, font=f_url)
    draw.text(((W - uw) // 2, 1620), url, fill=(255, 255, 200), font=f_url)

    return img


def generate_feature_video(feature):
    fid = feature["id"]
    print(f"\n=== Generating {fid}: {feature['title']} ===")
    frame_dir = f"{FRAMES_DIR}/{fid}"
    if os.path.exists(frame_dir):
        for f in os.listdir(frame_dir):
            os.remove(os.path.join(frame_dir, f))
    os.makedirs(frame_dir, exist_ok=True)

    # 動画タイムライン (25 秒, 750 frames @ 30fps):
    # Hook        : 0-3s   (90 frames)
    # Problem     : 3-8s   (150 frames)
    # Solution    : 8-13s  (150 frames)
    # Steps       : 13-19s (180 frames)
    # Benefit     : 19-23s (120 frames)
    # CTA         : 23-25s (60 frames)
    scenes = [
        ("Hook", 90, gen_hook),
        ("Problem", 150, gen_problem),
        ("Solution", 150, gen_solution),
        ("Steps", 180, gen_steps),
        ("Benefit", 120, gen_benefit),
        ("CTA", 60, gen_cta),
    ]

    frame_idx = 0
    for name, total, gen_func in scenes:
        for i in range(total):
            progress = i / total
            img = gen_func(feature, progress)
            img.save(f"{frame_dir}/{frame_idx:04d}.png", optimize=True)
            frame_idx += 1
        print(f"  {name}: {total} frames done")

    print(f"  Total frames: {frame_idx}")

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
    for f in os.listdir(frame_dir):
        os.remove(os.path.join(frame_dir, f))
    os.rmdir(frame_dir)
    return out_path


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    os.makedirs(FRAMES_DIR, exist_ok=True)

    print("ZERO-PAIN プロモ動画 v2 (ストーリー構成版)")
    print(f"出力先: {OUT_DIR}/")
    print(f"機能数: {len(FEATURES)}")
    print(f"1 本あたり: 25 秒 / 750 frames @ 30fps")

    generated = []
    for feature in FEATURES:
        path = generate_feature_video(feature)
        if path:
            generated.append(path)

    print("\n=== 完了 ===")
    for p in generated:
        print(f"  ✓ {p}")


if __name__ == "__main__":
    main()
