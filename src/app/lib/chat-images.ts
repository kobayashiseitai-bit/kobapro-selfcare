/**
 * ガイコツ先生のチャット応答に埋め込み可能な画像カタログ
 *
 * 使い方(運用):
 * - 新しい画像が完成したら ready: true に切り替えるか、新規エントリを追加
 * - ready: false のものは Claude には知らされない(ガイコツ先生は使わない)
 * - id はファイル名と一致させる(例: neck-1.png なら id: "neck-1")
 *
 * Claude側の使用ルール:
 * - <image id="ID" /> という形式でメッセージに埋め込む
 * - 1メッセージに最大2枚まで(過剰な使用を防止)
 */

export interface ChatImage {
  id: string;
  /** /public からの絶対パス */
  path: string;
  /** Claude に渡す説明(画像の中身を簡潔に) */
  desc: string;
  /** 関連する症状ID(複数可) */
  symptoms: string[];
  /** カテゴリ */
  category: "stretch" | "anatomy" | "lifestyle";
  /** true: ガイコツ先生が使える / false: 未完成・無効 */
  ready: boolean;
}

export const CHAT_IMAGES: ChatImage[] = [
  // ========== 首こり (neck) ==========
  {
    id: "neck-1",
    path: "/stretches/neck-1.png",
    desc: "首横倒しストレッチ。手の重みで頭を真横に倒し、首横の筋肉(胸鎖乳突筋)を伸ばす。",
    symptoms: ["neck"],
    category: "stretch",
    ready: true,
  },
  {
    id: "neck-2",
    path: "/stretches/neck-2.png",
    desc: "首回しストレッチ。頭をゆっくり時計回り・反時計回りに大きく回し、首全体の可動域を広げる。",
    symptoms: ["neck"],
    category: "stretch",
    ready: true,
  },
  {
    id: "neck-3",
    path: "/stretches/neck-3.png",
    desc: "あご引きストレッチ。壁に頭を押し当ててあごを引く、ストレートネック改善に効果的。",
    symptoms: ["neck"],
    category: "stretch",
    ready: true,
  },
  {
    id: "neck-4",
    path: "/stretches/neck-4.png",
    desc: "うなじストレッチ(肩甲挙筋ケア)。首を斜め前に倒して、うなじ奥の深層筋にアプローチ。",
    symptoms: ["neck", "shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "neck-5",
    path: "/stretches/neck-5.png",
    desc: "肩甲骨寄せストレッチ。胸を開いて肩甲骨を背骨方向にギュッと寄せる、姿勢改善にも◎。",
    symptoms: ["neck", "shoulder_stiff", "kyphosis"],
    category: "stretch",
    ready: true,
  },

  // ========== 肩こり (shoulder_stiff) ==========
  {
    id: "shoulder-1",
    path: "/stretches/shoulder-1.png",
    desc: "肩回し(前後)。両肩を大きく前後に回して肩甲骨を動かす、デスクワークの定番ケア。",
    symptoms: ["shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "shoulder-2",
    path: "/stretches/shoulder-2.png",
    desc: "腕の前後ストレッチ。腕を胸の前で伸ばし反対の手で引き寄せる、肩後部の三角筋を伸ばす。",
    symptoms: ["shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "shoulder-3",
    path: "/stretches/shoulder-3.png",
    desc: "タオルストレッチ。タオルを両手で持ち頭上から後方へ、四十肩・五十肩予防に効果絶大。",
    symptoms: ["shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "shoulder-4",
    path: "/stretches/shoulder-4.png",
    desc: "肩すくめストレッチ。肩を耳まですくめて5秒、ストンと脱力するシンプルな動き。",
    symptoms: ["shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "shoulder-5",
    path: "/stretches/shoulder-5.png",
    desc: "胸開きストレッチ。壁に手をついて体をひねり大胸筋を伸ばす、巻き肩・猫背に効果大。",
    symptoms: ["shoulder_stiff", "kyphosis"],
    category: "stretch",
    ready: true,
  },

  // ========== 腰痛 (back) ==========
  {
    id: "back-1",
    path: "/stretches/back-1.png",
    desc: "膝抱えストレッチ。仰向けで両膝を胸に引き寄せる、腰全体の筋肉を緩める基本動作。",
    symptoms: ["back"],
    category: "stretch",
    ready: true,
  },
  {
    id: "back-2",
    path: "/stretches/back-2.png",
    desc: "チャイルドポーズ(子供のポーズ)。正座から前に倒れて腰背中を伸ばす、リラックス効果も。",
    symptoms: ["back"],
    category: "stretch",
    ready: true,
  },

  // back-3 (完成済み)
  {
    id: "back-3",
    path: "/stretches/back-3.png",
    desc: "キャット&カウ。四つん這いから背中を反らす(カウ)→丸める(キャット)を呼吸とセットで繰り返し、背骨1つ1つを動かす。",
    symptoms: ["back"],
    category: "stretch",
    ready: true,
  },

  // back-4 (完成済み)
  {
    id: "back-4",
    path: "/stretches/back-4.png",
    desc: "ヒップリフト。仰向けで両膝を立て、お尻を締めながら腰を天井方向へ持ち上げ5秒キープ。15回×3セットでお尻と体幹を鍛え腰痛予防に効果絶大。",
    symptoms: ["back"],
    category: "stretch",
    ready: true,
  },
  // back-5 (完成済み)
  {
    id: "back-5",
    path: "/stretches/back-5.png",
    desc: "もも裏ストレッチ(ハムストリングス伸ばし)。仰向けで片足を天井方向へ持ち上げ、太もも裏を体に引き寄せて30秒キープ。骨盤の歪みと腰の負担を軽減。",
    symptoms: ["back"],
    category: "stretch",
    ready: true,
  },

  // ========== 未完成・準備中(完成したら ready: true に変更) ==========

  // ========== 眼精疲労 (eye_fatigue) - 完成済み ==========
  {
    id: "eye-1",
    path: "/stretches/eye-1.png",
    desc: "目パッチリ体操。両目を3秒ぎゅっと閉じてからパッと大きく見開く動作を10回繰り返し、3セット。目周りの筋肉を動かしリフレッシュ。",
    symptoms: ["eye_fatigue"],
    category: "stretch",
    ready: true,
  },
  {
    id: "eye-2",
    path: "/stretches/eye-2.png",
    desc: "ピント切り替え体操(遠近ストレッチ)。20cm先の親指と3m以上先の景色を交互に各3秒見る。1分×5セット。デスクワーク後におすすめ。",
    symptoms: ["eye_fatigue"],
    category: "stretch",
    ready: true,
  },
  {
    id: "eye-3",
    path: "/stretches/eye-3.png",
    desc: "眼球エクササイズ(眼球回し)。顔は正面に固定したまま眼球だけで上下左右を各3秒見て、その後時計回り・反時計回りに30秒ずつ。2セット。",
    symptoms: ["eye_fatigue"],
    category: "stretch",
    ready: true,
  },
  {
    id: "eye-4",
    path: "/stretches/eye-4.png",
    desc: "ホットアイタオル(温タオル)。濡らしたフェイスタオルを電子レンジ500W30〜40秒温め、40〜45℃くらいで目に5分のせる。やけど注意。",
    symptoms: ["eye_fatigue"],
    category: "stretch",
    ready: true,
  },
  {
    id: "eye-5",
    path: "/stretches/eye-5.png",
    desc: "晴明ツボ押し。目頭の少し上・鼻の横の小さなくぼみ「晴明」を人差し指で目頭方向に10秒押し込む。5回繰り返し。眼精疲労の代表ツボ。",
    symptoms: ["eye_fatigue"],
    category: "stretch",
    ready: true,
  },

  // ========== 頭痛 (headache) - 完成済み ==========
  {
    id: "headache-1",
    path: "/stretches/headache-1.png",
    desc: "こめかみマッサージ。両手の3本指でこめかみに当て、時計回り→反時計回りに各30秒円を描くようにマッサージ。緊張型頭痛のセルフケア。",
    symptoms: ["headache"],
    category: "stretch",
    ready: true,
  },
  {
    id: "headache-2",
    path: "/stretches/headache-2.png",
    desc: "後頭部ツボ押し(首の付け根マッサージ)。両手の親指を後頭部の下のくぼみに当てて30秒押す。首・頭の緊張を緩める。",
    symptoms: ["headache", "neck"],
    category: "stretch",
    ready: true,
  },
  {
    id: "headache-3",
    path: "/stretches/headache-3.png",
    desc: "目まわりツボ押し。攢竹・魚腰・絲竹空・瞳子膠・晴明の5つのツボを各5秒順番に押す。眼精疲労からくる頭痛に効果的。",
    symptoms: ["headache", "eye_fatigue"],
    category: "stretch",
    ready: true,
  },
  {
    id: "headache-4",
    path: "/stretches/headache-4.png",
    desc: "首前面ストレッチ。両手を鎖骨の下に置いて皮膚を押さえ、頭をゆっくり後ろに倒す。首前面〜鎖骨周りを伸ばす。",
    symptoms: ["headache", "neck"],
    category: "stretch",
    ready: true,
  },
  {
    id: "headache-5",
    path: "/stretches/headache-5.png",
    desc: "肩回しエクササイズ(肩甲骨ストレッチ)。両手を肩にのせて肘で大きな円を描き、前後30秒ずつ回す。肩甲骨の動きを引き出し肩こり由来の頭痛をケア。",
    symptoms: ["headache", "shoulder_stiff"],
    category: "stretch",
    ready: true,
  },

  // ========== 猫背改善 (kyphosis) - 完成済み ==========
  {
    id: "kyphosis-1",
    path: "/stretches/kyphosis-1.png",
    desc: "胸開きストレッチ。両手を背中の後ろで組んで肩甲骨を中心に寄せ、あごを引いたまま目線を天井へ。30秒キープ×3セット。巻き肩・猫背改善の基本。",
    symptoms: ["kyphosis", "shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "kyphosis-2",
    path: "/stretches/kyphosis-2.png",
    desc: "壁立ち姿勢チェック(壁立ちエクササイズ)。後頭部・両肩・お尻・かかとの4点を壁につけ1分キープ。理想の立ち姿勢を体に覚えさせる。3セット。",
    symptoms: ["kyphosis"],
    category: "stretch",
    ready: true,
  },
  {
    id: "kyphosis-3",
    path: "/stretches/kyphosis-3.png",
    desc: "肩甲骨よせエクササイズ。両腕を肩の高さで横に伸ばし肘を90度に曲げ、肩甲骨を背骨に向かってギュッと寄せて10秒キープ。15回繰り返し。",
    symptoms: ["kyphosis", "shoulder_stiff"],
    category: "stretch",
    ready: true,
  },
  {
    id: "kyphosis-4",
    path: "/stretches/kyphosis-4.png",
    desc: "タオル胸ひらきストレッチ(胸椎ストレッチ)。直径10cmに丸めたバスタオルを肩甲骨の間(胸椎)に置いて仰向け、両腕を「T」の字に開いて1分キープ。2セット。",
    symptoms: ["kyphosis"],
    category: "stretch",
    ready: true,
  },
  {
    id: "kyphosis-5",
    path: "/stretches/kyphosis-5.png",
    desc: "あご引きエクササイズ。頭頂を糸で引っ張られるイメージで首を長く保ち、あごを後ろに水平移動させて二重あご状態で5秒キープ。20回繰り返し。ストレートネック対策にも。",
    symptoms: ["kyphosis", "neck"],
    category: "stretch",
    ready: true,
  },
];

/**
 * Claude のシステムプロンプトに差し込む画像リストを生成
 * ready: true のものだけ含める
 */
export function buildAvailableImagesForPrompt(): string {
  const ready = CHAT_IMAGES.filter((img) => img.ready);
  if (ready.length === 0) return "";

  const lines = ready.map((img) => `- ${img.id}: ${img.desc}`).join("\n");

  return `

【会話で使える画像リスト(重要)】
以下の画像を会話メッセージに埋め込めます。説明する内容にピッタリ合うものがあれば、メッセージの中に <image id="画像ID" /> という形式で埋め込んでください。

${lines}

【画像の使用ルール】
1. 1つのメッセージに**最大2枚まで**
2. 関連性が高い場合のみ使用(無理に使わない・画像紹介だけのメッセージにしない)
3. 画像タグの前後で文章が自然に繋がるように書く
4. リストにないIDは絶対に使わない(404になります)
5. 文章で軽く紹介してから画像を出すと自然(例: 「こちらのストレッチが効果的です: <image id="neck-1" />」)
6. 自己紹介や挨拶のメッセージには画像を入れない`;
}

/** ID から ChatImage を取得(ready=true のもののみ) */
export function getChatImageById(id: string): ChatImage | undefined {
  return CHAT_IMAGES.find((img) => img.id === id && img.ready);
}
