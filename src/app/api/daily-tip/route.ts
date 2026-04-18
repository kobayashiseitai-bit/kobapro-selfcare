import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// 月ごとの旬の食材＋姿勢・痛みとの関連情報
// （運用コストゼロ：クライアント向けに日替わりで返すだけ）
const SEASONAL_TIPS: Record<number, Array<{ emoji: string; title: string; body: string }>> = {
  1: [
    { emoji: "🥬", title: "白菜", body: "冬が旬の白菜はビタミンCと食物繊維が豊富。体を温めながら腸を整えて、冷えからくる肩こりを予防します。" },
    { emoji: "🍊", title: "みかん", body: "ビタミンC・クエン酸が豊富で疲労回復◎。冬場のデスクワーク疲れの首こりケアにおすすめです。" },
    { emoji: "🐟", title: "ぶり", body: "DHA・EPAが豊富で血流改善。冬の寒さによる筋肉の緊張をほぐす助けになります。" },
  ],
  2: [
    { emoji: "🍓", title: "いちご", body: "ビタミンCがレモンより多い。抗酸化作用で筋肉疲労の回復を早め、姿勢維持を助けます。" },
    { emoji: "🥦", title: "ブロッコリー", body: "ビタミンK・カルシウムで骨を丈夫に。デスクワーク姿勢で負担がかかる背骨のケアに最適。" },
    { emoji: "🦪", title: "牡蠣", body: "亜鉛が豊富で新陳代謝を促進。傷ついた筋肉の回復を助け、肩こり改善に役立ちます。" },
  ],
  3: [
    { emoji: "🥬", title: "菜の花", body: "ビタミンC・β-カロテン・鉄分が豊富。春のだるさ解消と、血行改善で肩こり予防に◎。" },
    { emoji: "🍤", title: "ほたるいか", body: "タウリンで肝機能UP・血流改善。デスクワーク後の体のだるさに効きます。" },
    { emoji: "🥗", title: "アスパラ", body: "アスパラギン酸で疲労回復。春先の気候変化による自律神経の乱れをサポート。" },
  ],
  4: [
    { emoji: "🧅", title: "新玉ねぎ", body: "今が旬の新玉ねぎは甘みが強く生食OK。アリシンが血流改善を促し、首こり・肩こり予防に◎。" },
    { emoji: "🎋", title: "たけのこ", body: "食物繊維で腸活。カリウムがむくみを解消して、体の重だるさを軽減します。" },
    { emoji: "🐟", title: "かつお（初鰹）", body: "タンパク質とビタミンB群が豊富。筋肉の材料＋疲労回復で姿勢維持力UP。" },
  ],
  5: [
    { emoji: "🌱", title: "そら豆", body: "タンパク質と食物繊維が豊富。姿勢を支える筋肉の維持に欠かせません。" },
    { emoji: "🍓", title: "さくらんぼ", body: "メラトニンで睡眠の質UP。よい睡眠は姿勢改善と筋肉回復の基本です。" },
    { emoji: "🌿", title: "新ごぼう", body: "食物繊維で腸内環境を整え、便秘による腰の重さを軽減。" },
  ],
  6: [
    { emoji: "🍆", title: "なす", body: "体を冷やす効果と抗酸化作用。夏場のだるさと炎症による肩こりを抑えます。" },
    { emoji: "🥒", title: "きゅうり", body: "水分と電解質で水分補給。暑い時期の水分不足による筋肉のこりを予防。" },
    { emoji: "🍑", title: "梅", body: "クエン酸で疲労回復・食欲増進。梅雨の重だるさを吹き飛ばします。" },
  ],
  7: [
    { emoji: "🍅", title: "トマト", body: "リコピン＋水分補給で夏バテ予防。抗酸化作用が筋肉の炎症を抑えます。" },
    { emoji: "🌽", title: "とうもろこし", body: "糖質＋食物繊維で夏の活動エネルギー補給。便秘解消で腰痛予防にも。" },
    { emoji: "🍑", title: "桃", body: "ペクチンとビタミンEで美肌＋血行促進。冷房による肩こり予防に◎。" },
  ],
  8: [
    { emoji: "🍉", title: "すいか", body: "シトルリンで血管拡張、水分補給、カリウムでむくみ解消。夏の疲労による重だるさに。" },
    { emoji: "🌶️", title: "ピーマン", body: "ビタミンCは加熱しても失われにくい。夏バテ予防に積極的に。" },
    { emoji: "🐟", title: "うなぎ", body: "ビタミンB群・タンパク質で夏バテ完全KO。筋肉維持に最適。" },
  ],
  9: [
    { emoji: "🍇", title: "ぶどう", body: "ポリフェノールで血行促進、疲労回復。夏の疲れが出る時期に◎。" },
    { emoji: "🍎", title: "梨", body: "水分補給＋ソルビトールで便秘解消。腸を整えて腰の不調予防。" },
    { emoji: "🍄", title: "きのこ類", body: "ビタミンDとβグルカンで免疫強化。秋の気温差による体調不良対策。" },
  ],
  10: [
    { emoji: "🍠", title: "さつまいも", body: "食物繊維とビタミンCが豊富。腸内環境を整えて便秘からくる腰痛を予防。" },
    { emoji: "🎃", title: "かぼちゃ", body: "β-カロテン、ビタミンEで血行促進。寒くなり始めの肩こり対策に。" },
    { emoji: "🐟", title: "さんま", body: "DHA・EPAが血流を改善。寒くなりかけで筋肉が固まる前に摂取を。" },
  ],
  11: [
    { emoji: "🍠", title: "里芋", body: "ムチンで胃腸の粘膜保護、食物繊維で腸活。寒くなる時期の腸冷えに◎。" },
    { emoji: "🍊", title: "ゆず", body: "ビタミンC・リモネンでリラックス効果。ストレス性の首こりに◎。" },
    { emoji: "🥬", title: "春菊", body: "β-カロテン、鉄分が豊富。冷えからくる肩こりの予防に。" },
  ],
  12: [
    { emoji: "🥬", title: "ほうれん草", body: "鉄分とビタミンCで貧血予防・血流改善。冬の冷えによる肩こりケアに。" },
    { emoji: "🥕", title: "にんじん", body: "β-カロテンで粘膜を強化、免疫UP。寒い時期の体調管理に必須。" },
    { emoji: "🍊", title: "温州みかん", body: "ビタミンC、ヘスペリジンで毛細血管を強化。冷え性改善で全身の血行UP。" },
  ],
};

function pickTip(month: number, dayOfYear: number) {
  const tips = SEASONAL_TIPS[month] || SEASONAL_TIPS[1];
  return tips[dayOfYear % tips.length];
}

export async function GET(_req: NextRequest) {
  const now = new Date();
  const month = now.getMonth() + 1;
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24)
  );
  const tip = pickTip(month, dayOfYear);

  return NextResponse.json({
    date: now.toISOString().slice(0, 10),
    month,
    tip,
  });
}
