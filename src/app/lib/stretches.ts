// ストレッチコンテンツ定義
// 6症状 × 5ストレッチ = 30件
// 画像は /public/stretches/ に配置（初期はプレースホルダー）

export interface Stretch {
  id: string;
  title: string;
  image: string; // 画像パス（後でGIFに差し替え可能）
  duration: string; // 実施時間
  reps: string; // 回数・セット
  steps: string[]; // 手順
  tips: string; // コツ・注意点
  benefit: string; // 効果
}

export interface StretchCategory {
  symptomId: string;
  stretches: Stretch[];
}

export const STRETCH_DATA: StretchCategory[] = [
  // ========== 首こり ==========
  {
    symptomId: "neck",
    stretches: [
      {
        id: "neck-1",
        title: "首の横倒しストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "左右各20秒",
        reps: "3セット",
        steps: [
          "背筋を伸ばして椅子に座る",
          "右手を頭の左側に軽く添える",
          "ゆっくりと頭を右に倒して首の左側を伸ばす",
          "20秒キープして反対側も同様に",
        ],
        tips: "肩が上がらないように、反対側の肩は下げる意識で",
        benefit: "首周りの緊張を和らげ、血行を促進",
      },
      {
        id: "neck-2",
        title: "首回しストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "各方向30秒",
        reps: "2セット",
        steps: [
          "背筋を伸ばして座る",
          "頭をゆっくり前に倒す",
          "時計回りに大きくゆっくり回す",
          "反時計回りも同様に",
        ],
        tips: "無理に大きく回さず、痛みのない範囲で",
        benefit: "首全体の可動域を広げ、コリをほぐす",
      },
      {
        id: "neck-3",
        title: "あご引きストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "10秒キープ",
        reps: "10回",
        steps: [
          "壁に背中をつけて立つ",
          "あごを引き、頭を壁に押し付ける",
          "首の後ろが伸びる感覚を意識",
          "10秒キープして力を抜く",
        ],
        tips: "二重あごを作るように意識すると効果的",
        benefit: "ストレートネック改善、首後部の筋肉強化",
      },
      {
        id: "neck-4",
        title: "首の斜め伸ばし",
        image: "/stretches/placeholder.jpg",
        duration: "左右各20秒",
        reps: "3セット",
        steps: [
          "背筋を伸ばして座る",
          "頭を斜め前に倒す（右斜め前45度）",
          "右手で頭を軽く押して伸ばす",
          "反対側も同様に",
        ],
        tips: "首の後ろから肩にかけての筋肉を意識",
        benefit: "僧帽筋上部の緊張を緩和",
      },
      {
        id: "neck-5",
        title: "肩甲骨寄せストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "5秒キープ",
        reps: "15回",
        steps: [
          "両腕を胸の前で交差させる",
          "肩甲骨を背中の中心に寄せるイメージ",
          "胸を開いて5秒キープ",
          "ゆっくり戻す",
        ],
        tips: "肩甲骨を動かすことを意識",
        benefit: "姿勢改善、首肩の負担軽減",
      },
    ],
  },
  // ========== 肩凝り ==========
  {
    symptomId: "shoulder_stiff",
    stretches: [
      {
        id: "shoulder-1",
        title: "肩回し（前後）",
        image: "/stretches/placeholder.jpg",
        duration: "各方向30秒",
        reps: "2セット",
        steps: [
          "両腕を脱力して立つ",
          "肩を前から後ろに大きく回す",
          "次は後ろから前に回す",
          "呼吸を止めないこと",
        ],
        tips: "肩甲骨から大きく動かすイメージで",
        benefit: "肩関節の可動域改善、血行促進",
      },
      {
        id: "shoulder-2",
        title: "腕の前後ストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "左右各20秒",
        reps: "3セット",
        steps: [
          "右腕を胸の前で水平に伸ばす",
          "左手で右肘を体に引き寄せる",
          "肩の後ろが伸びる感覚を意識",
          "反対側も同様に",
        ],
        tips: "肩甲骨の外側を意識",
        benefit: "肩関節周りの筋肉をほぐす",
      },
      {
        id: "shoulder-3",
        title: "タオルストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "15秒キープ",
        reps: "10回",
        steps: [
          "両手でタオルの両端を持つ",
          "頭上に腕を伸ばす",
          "タオルを背中側にゆっくり下ろす",
          "肩甲骨を寄せながら戻す",
        ],
        tips: "腕が曲がらないように意識",
        benefit: "四十肩・五十肩予防、肩の柔軟性向上",
      },
      {
        id: "shoulder-4",
        title: "肩すくめストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "5秒キープ",
        reps: "20回",
        steps: [
          "両肩を耳に近づけるようにすくめる",
          "5秒キープ",
          "ストンと力を抜いて落とす",
          "これを繰り返す",
        ],
        tips: "力を抜く時の開放感を味わう",
        benefit: "肩周りの筋肉リラックス",
      },
      {
        id: "shoulder-5",
        title: "胸開きストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "30秒キープ",
        reps: "3セット",
        steps: [
          "壁の横に立ち、片手を壁につける",
          "肩の高さで肘をまっすぐに",
          "体を壁と反対側にひねる",
          "胸の前が伸びる感覚を意識",
        ],
        tips: "巻き肩改善にも効果的",
        benefit: "胸筋ほぐし、肩の位置改善",
      },
    ],
  },
  // ========== 腰痛 ==========
  {
    symptomId: "back",
    stretches: [
      {
        id: "back-1",
        title: "膝抱えストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "30秒キープ",
        reps: "3セット",
        steps: [
          "仰向けに寝る",
          "両膝を胸に引き寄せる",
          "両手で膝を抱える",
          "腰が床から浮くまで深く引き寄せる",
        ],
        tips: "腰の下の部分が伸びる感覚を意識",
        benefit: "腰部全体の緊張を緩和",
      },
      {
        id: "back-2",
        title: "腰ひねりストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "左右各20秒",
        reps: "3セット",
        steps: [
          "仰向けに寝る",
          "右膝を立てて左側に倒す",
          "顔は右を向く",
          "反対側も同様に",
        ],
        tips: "肩は床につけたまま",
        benefit: "腰椎周りの可動性改善",
      },
      {
        id: "back-3",
        title: "キャット&カウ",
        image: "/stretches/placeholder.jpg",
        duration: "10回",
        reps: "3セット",
        steps: [
          "四つん這いになる",
          "息を吸いながら背中を反らす（カウ）",
          "息を吐きながら背中を丸める（キャット）",
          "ゆっくり繰り返す",
        ],
        tips: "呼吸と動きを合わせることが重要",
        benefit: "背骨全体の柔軟性向上",
      },
      {
        id: "back-4",
        title: "ヒップリフト",
        image: "/stretches/placeholder.jpg",
        duration: "5秒キープ",
        reps: "15回 × 3セット",
        steps: [
          "仰向けで両膝を立てる",
          "お尻を上にゆっくり持ち上げる",
          "肩から膝まで一直線に",
          "5秒キープしてゆっくり下ろす",
        ],
        tips: "お尻を締める意識で",
        benefit: "体幹強化、腰痛予防",
      },
      {
        id: "back-5",
        title: "ハムストリングス伸ばし",
        image: "/stretches/placeholder.jpg",
        duration: "左右各30秒",
        reps: "2セット",
        steps: [
          "仰向けに寝る",
          "右足を天井に向けて伸ばす",
          "両手で太ももの裏を持って引き寄せる",
          "反対側も同様に",
        ],
        tips: "膝は軽く曲がっていてOK",
        benefit: "もも裏の柔軟性向上、腰の負担軽減",
      },
    ],
  },
  // ========== 頭痛 ==========
  {
    symptomId: "headache",
    stretches: [
      {
        id: "headache-1",
        title: "こめかみマッサージ",
        image: "/stretches/placeholder.jpg",
        duration: "1分",
        reps: "3セット",
        steps: [
          "両手の指3本をこめかみに当てる",
          "小さく円を描くようにマッサージ",
          "時計回り30秒、反時計回り30秒",
          "呼吸をゆっくり深く",
        ],
        tips: "力を入れすぎず気持ち良い強さで",
        benefit: "緊張性頭痛の緩和",
      },
      {
        id: "headache-2",
        title: "首の付け根マッサージ",
        image: "/stretches/placeholder.jpg",
        duration: "30秒",
        reps: "3セット",
        steps: [
          "両手の親指を首の付け根（後頭部）に当てる",
          "頭の重みをかけてツボ押し",
          "痛気持ちいい場所を探す",
          "深呼吸しながら30秒",
        ],
        tips: "後頭下筋群という頭痛のツボ",
        benefit: "頭部への血流改善",
      },
      {
        id: "headache-3",
        title: "目の周りツボ押し",
        image: "/stretches/placeholder.jpg",
        duration: "各5秒",
        reps: "5ヶ所 × 3回",
        steps: [
          "眉頭の下のくぼみを親指で押す",
          "眉の中央を押す",
          "こめかみを押す",
          "目尻の下を押す",
        ],
        tips: "眼精疲労からくる頭痛に効果的",
        benefit: "目の疲れ解消、頭痛予防",
      },
      {
        id: "headache-4",
        title: "首の前ストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "20秒キープ",
        reps: "5回",
        steps: [
          "背筋を伸ばして座る",
          "あごを上げて天井を見る",
          "首の前が伸びる感覚を意識",
          "ゆっくり戻す",
        ],
        tips: "肩の力は抜いて",
        benefit: "首前面の緊張緩和",
      },
      {
        id: "headache-5",
        title: "肩甲骨ストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "30秒",
        reps: "3セット",
        steps: [
          "両手を肩に置く",
          "肘で大きく円を描く",
          "前回し30秒、後ろ回し30秒",
          "呼吸を止めない",
        ],
        tips: "肩甲骨から動かす意識で",
        benefit: "上半身の血流改善",
      },
    ],
  },
  // ========== 眼精疲労 ==========
  {
    symptomId: "eye_fatigue",
    stretches: [
      {
        id: "eye-1",
        title: "目のパチパチ体操",
        image: "/stretches/placeholder.jpg",
        duration: "1分",
        reps: "3セット",
        steps: [
          "目をぎゅっと閉じる（3秒）",
          "パッと大きく開く（3秒）",
          "10回繰り返す",
          "涙が出てきたらOK",
        ],
        tips: "ドライアイ予防にも効果的",
        benefit: "涙の分泌促進、目の血流改善",
      },
      {
        id: "eye-2",
        title: "遠近ストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "1分",
        reps: "5セット",
        steps: [
          "親指を顔の前20cmに立てる",
          "親指をじっと見る（3秒）",
          "遠くの景色を見る（3秒）",
          "交互に繰り返す",
        ],
        tips: "ピント調節筋の柔軟性向上",
        benefit: "老眼予防、目のピント機能改善",
      },
      {
        id: "eye-3",
        title: "眼球回し",
        image: "/stretches/placeholder.jpg",
        duration: "各方向30秒",
        reps: "2セット",
        steps: [
          "顔は動かさず眼球だけを動かす",
          "上下左右をゆっくり見る",
          "時計回りに大きく回す",
          "反時計回りも同様に",
        ],
        tips: "無理に動かさず気持ちよい範囲で",
        benefit: "目の周りの筋肉リラックス",
      },
      {
        id: "eye-4",
        title: "温タオル",
        image: "/stretches/placeholder.jpg",
        duration: "5分",
        reps: "1回",
        steps: [
          "タオルをお湯で濡らして絞る",
          "電子レンジで30秒温める",
          "目の上に乗せて5分",
          "冷めたら終了",
        ],
        tips: "熱すぎないよう注意",
        benefit: "目の周りの血行促進、疲労回復",
      },
      {
        id: "eye-5",
        title: "ツボ押し（晴明）",
        image: "/stretches/placeholder.jpg",
        duration: "10秒",
        reps: "5回",
        steps: [
          "目頭の少し上のくぼみに親指を当てる",
          "痛気持ちいい強さで押す",
          "10秒キープ",
          "ゆっくり離す",
        ],
        tips: "目頭の鼻寄りの部分",
        benefit: "眼精疲労・かすみ目改善",
      },
    ],
  },
  // ========== 猫背改善 ==========
  {
    symptomId: "kyphosis",
    stretches: [
      {
        id: "kyphosis-1",
        title: "胸開きストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "30秒",
        reps: "3セット",
        steps: [
          "両手を後ろで組む",
          "肩甲骨を寄せながら胸を開く",
          "あごを引いたまま天井を見る",
          "30秒キープ",
        ],
        tips: "腰を反らしすぎない",
        benefit: "巻き肩・猫背改善",
      },
      {
        id: "kyphosis-2",
        title: "壁に背中つけ",
        image: "/stretches/placeholder.jpg",
        duration: "1分",
        reps: "3セット",
        steps: [
          "壁に後頭部・背中・お尻・かかとをつける",
          "腰と壁の隙間に手のひらが入る程度に",
          "このまま1分キープ",
          "正しい姿勢を体で覚える",
        ],
        tips: "毎日続けることで姿勢が改善",
        benefit: "正しい姿勢の習得",
      },
      {
        id: "kyphosis-3",
        title: "肩甲骨寄せ",
        image: "/stretches/placeholder.jpg",
        duration: "10秒",
        reps: "15回",
        steps: [
          "両腕を肩の高さで後ろに引く",
          "肩甲骨を背骨に寄せる",
          "10秒キープ",
          "ゆっくり戻す",
        ],
        tips: "肩が上がらないように",
        benefit: "背中の筋力強化、姿勢改善",
      },
      {
        id: "kyphosis-4",
        title: "胸椎ストレッチ",
        image: "/stretches/placeholder.jpg",
        duration: "1分",
        reps: "2セット",
        steps: [
          "丸めたタオルを胸椎（肩甲骨の間）に敷く",
          "仰向けに寝て両腕を広げる",
          "胸が開く感覚を意識",
          "1分キープ",
        ],
        tips: "テニスボールでも代用可",
        benefit: "胸椎の可動性向上、猫背矯正",
      },
      {
        id: "kyphosis-5",
        title: "あご引きエクササイズ",
        image: "/stretches/placeholder.jpg",
        duration: "5秒",
        reps: "20回",
        steps: [
          "立った状態であごを引く",
          "首が長くなるイメージ",
          "5秒キープしてゆっくり戻す",
          "これを繰り返す",
        ],
        tips: "スマホ首改善にも",
        benefit: "ストレートネック改善、姿勢矯正",
      },
    ],
  },
];

export function getStretchesBySymptom(symptomId: string): Stretch[] {
  const category = STRETCH_DATA.find((c) => c.symptomId === symptomId);
  return category?.stretches || [];
}
