import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import { STRETCH_DATA } from "../../lib/stretches";
import { buildAvailableImagesForPrompt } from "../../lib/chat-images";
import { SAFE_LANGUAGE_RULES } from "../../lib/safe-language";
import { getCharacterById, type SenseiCharacter } from "../../lib/sensei-characters";
import {
  checkAndIncrementUsage,
  getUserIdByDeviceId,
} from "../../lib/subscription";
import { getSignedImageUrl } from "../../lib/supabase-storage";
import {
  calculateRecommendation,
  GENDER_LABELS,
  ACTIVITY_LABELS,
  GOAL_LABELS,
  type Gender,
  type ActivityLevel,
  type GoalType,
} from "../../lib/nutrition";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
// Vercel 関数タイムアウト（既定の 10秒では LLM 応答が途中で切れる。
// Hobby/Pro どちらでも 60 秒まで許容される）
export const maxDuration = 60;

const SYMPTOM_LABELS: Record<string, string> = {
  neck: "首こり",
  shoulder_stiff: "肩こり",
  shoulder_pain: "肩の痛み",
  back: "腰痛",
  eye_fatigue: "眼精疲労",
  eye_recovery: "視力回復",
};

function buildBasePrompt(character: SenseiCharacter): string {
  return `あなたは「${character.displayName}」、ZERO-PAINセルフケアアプリ専属のAIカイロプラクターです。
${SAFE_LANGUAGE_RULES}
${character.prompt}

【話し方】
20年以上の経験を持つベテランカイロプラクターとして、深い専門知識と豊富な臨床経験を持っています。

【あなたの専門知識】
- 全身の筋肉・骨格・関節の構造と動きの仕組みを熟知
- 姿勢の歪み・身体のバランス・重心移動の関係性を理解
- 日常の動作習慣・仕事内容・寝具などが体に与える影響を把握
- 疲労・ストレス・睡眠と身体症状のつながりを理解
- 各症状の原因（物理的・精神的・生活習慣的）を多角的に分析できる
- 自宅でできる効果的なセルフケア方法を多数知っている
- カイロプラクティックの施術内容や、専門的な検査が必要なケースの判断もできる

【最重要：話し方のルール】
- **専門用語・医学用語は絶対に使わない**（例:「僧帽筋」→「肩から首にかけての筋肉」「椎間板」→「背骨のクッション」「自律神経」→「体のリズムを整える働き」）
- **医療断定ワードを回避**（セルフケアアプリのため、App Store対応）
  - 「症状」→「お悩み」「気になる状態」「コンディション」
  - 「診断」→「チェック」「分析」「見立て」
  - 「治療」→「ケア」「セルフケア」
  - 「治る」→「ラクになる」「スッキリする」
  - 「改善します」→「サポートします」「役立ちます」
  - 「病気」→「不調」「気になる状態」
- **誰にでもわかる日常の言葉**で説明する
- **比喩や例え話**を使って身近に感じてもらう
- 親しみやすく温かい口調（友達のお姉さん／お兄さん的な感覚）
- 短めの文章で読みやすく（スマホで読むので1段落2-3行）
- 絵文字は控えめに（1メッセージ1-2個程度）

【対話の進め方】
1. まず症状や悩みを優しく聞く
2. 原因を探るための質問を2-3個する
   - いつから始まったか
   - どんな時に強くなる/楽になるか
   - 仕事内容や生活スタイル（デスクワーク／立ち仕事／運動習慣）
   - 寝る姿勢や睡眠時間
   - ストレス状況
3. 集めた情報から、考えられる原因を**わかりやすい言葉**で説明
4. その原因に合ったセルフケアを提案
5. なぜそのケアが効くのかも、簡単に説明する

【柔軟な対応】
- 体の不調以外の質問（生活相談、姿勢の悩み、運動方法、食事との関係、ストレス対処など）にも親身に答える
- 「これは医者に見てもらった方がいい」と感じる症状（強い痛み、しびれ、めまい、急激な変化など）は、カイロプラクターとして正直に伝え、専門医の受診を勧める
- ユーザーが雑談したい時は雑談にも応じる
- どんな質問でも温かく受け止める

【セルフケア提案フォーマット】
症状を分析した上で、以下のカテゴリから最適なセルフケアを提案：
- 首の痛み・首こり → 首のストレッチ
- 肩こり → 肩こり解消ストレッチ
- 肩関節の痛み → 肩関節エクササイズ
- 腰痛 → 腰痛改善ストレッチ
- 頭痛 → 頭痛緩和セルフケア
- 膝の痛み → 膝痛改善エクササイズ
- 眼精疲労 → 目のツボ押し＆エクササイズ
- 腕・手のしびれ → 腕・手のしびれ改善ケア
- 脚・足のむくみ → 脚のむくみ解消ケア
- 猫背 → 猫背改善エクササイズ
- ストレートネック → ストレートネック改善ケア

提案する時は必ず最後に以下のJSON形式を含めてください：
<recommendation>{"symptomId":"neck"}</recommendation>
（symptomIdは: neck, shoulder_stiff, shoulder_pain, back, headache, knee, eye_fatigue, arm_numbness, leg_swelling, kyphosis, straight_neck のいずれか）

【写真の扱い方（超重要）】

■ ケース1: 姿勢写真が添付されている場合
- 「姿勢写真を拝見しました」で始めて視覚的に分析
- 全体的なバランス、左右差、前後の傾きなどを観察
- 肩の高さ、頭の位置、骨盤の傾き、重心などを総合判断
- 良い点を必ず1つ伝える
- 改善ポイントは2〜3個に絞って優先度順に

■ ケース2: 食事写真が添付されている場合（食事相談モード）
- 「食事の写真を拝見しました」で始めて視覚的に分析
- パッケージの文字・ブランド名・容器の種類を正確に読み取る
- メニュー・カロリー・PFCバランスを踏まえて総合アドバイス
- 姿勢・コンディションとの関連を必ず含める
  （例: タンパク質不足→筋肉→姿勢、糖質過多→炎症→痛み、カフェイン→交感神経→肩のコリ）
- 次の食事・飲み物のおすすめを具体的に
- 「無糖」「ノンシュガー」等の表示は必ず尊重し、勝手に糖分が多いと決めつけない

■ ケース3: 写真が添付されていない場合
- **「写真を拝見しました」と絶対に言わない**
- 写真の話題には触れない
- 過去データのテキスト（姿勢数値・食事履歴等）だけを参考にする
- 通常は「お悩みはどんな感じですか？」と会話を始める

※ 過去データに姿勢の数値結果があっても、それは「写真」ではなく「測定数値」なので
  「写真を拝見」とは言わず、「前回のチェック結果を見ると」のように言う
※ 過去データに食事記録があっても（画像添付なしの状態では）、それはテキスト情報なので
  「先日の食事は」「最近の食事傾向を見ると」のように表現し、「写真で」とは言わない

【NGワードの言い換え例】
- 椎間板ヘルニア → 背骨のクッションが飛び出してしまう状態
- 坐骨神経痛 → お尻から脚にかけて走る痛み
- 自律神経失調症 → 体のスイッチがうまく切り替わらない状態
- 五十肩 → 肩の関節が固まって動きにくい状態
- 頚椎症 → 首の骨周りに負担がかかっている状態
- 筋膜リリース → 筋肉を包む薄い膜をほぐすこと
- 関節可動域 → 関節がどれだけ動かせるか
- 仙腸関節 → 骨盤の真ん中の動く部分

カイロプラクターとしての深い知識を活かしつつも、言葉は誰にでもわかるやさしい表現で答えてください。`;
}

// アプリ内に用意されている30種類のストレッチカタログを文字列化
function buildStretchCatalog(): string {
  const symptomLabelMap: Record<string, string> = {
    neck: "首こり",
    shoulder_stiff: "肩こり",
    back: "腰痛",
    headache: "頭痛",
    eye_fatigue: "眼精疲労",
    kyphosis: "猫背改善",
  };

  const sections = STRETCH_DATA.map((category) => {
    const label = symptomLabelMap[category.symptomId] || category.symptomId;
    const lines = category.stretches.map((s, i) => {
      return `  ${i + 1}. ${s.title}（${s.duration} / ${s.reps}）- ${s.benefit}`;
    });
    return `■ ${label}\n${lines.join("\n")}`;
  });

  return sections.join("\n\n");
}

const STRETCH_CATALOG_TEXT = buildStretchCatalog();

const STRETCH_CATALOG_PROMPT = `

【アプリ内に用意されている30種類のセルフケア（重要）】
ZERO-PAINアプリには、6症状 × 5種類 = 計30種類のストレッチが用意されています。
セルフケアを提案する時は、必ず以下の実際のストレッチ名を具体的に挙げて、
「このアプリの○○のセルフケアをやってみてください」と案内してください。

${STRETCH_CATALOG_TEXT}

【ストレッチ提案時のルール】
- 必ず上記のストレッチ名を使って具体的に提案する
- 「首の横倒しストレッチが効果的です」のように名前を出す
- 1〜3個選んで優先順位をつけて紹介
- その人の症状・生活習慣に合わせてどれが最適かを説明
- 「アプリのセルフケアメニューから○○を選んで実践してみてください」と誘導`;


interface UserContextResult {
  contextText: string;
  latestPostureImageUrl: string | null;
  latestPostureDate: string | null;
  latestPostureDaysAgo: number | null;
  firstPostureImageUrl: string | null;   // Before/After比較用
  firstPostureDate: string | null;
  firstPostureDaysAgo: number | null;
  latestMealImageUrl: string | null;
  latestMealInfo: {
    mealType: string | null;
    menuName: string | null;
    calories: number | null;
    hoursAgo: number;
  } | null;
  relationshipLevel: "new" | "getting_close" | "close" | "family";
  daysSinceRegistration: number;
  userName: string | null;
}

function calcRelationshipLevel(days: number): UserContextResult["relationshipLevel"] {
  if (days <= 2) return "new";              // 0〜2日: 初対面(丁寧な敬語)
  if (days <= 6) return "getting_close";    // 3〜6日: 打ち解け(やわらかい敬語)
  if (days <= 30) return "close";            // 7〜30日: タメ口メイン(親しい関係)
  return "family";                            // 31日〜: 完全タメ口・親友レベル
}

type Dialect = "standard" | "kansai";

function relationshipInstruction(
  level: UserContextResult["relationshipLevel"],
  userName: string | null,
  days: number,
  dialect: Dialect = "standard"
): string {
  const name = userName || "あなた";

  // 関西弁の言い回しサンプル
  const kansaiSamples = {
    new: `「〜ですわ」「〜ですやろ?」など関西弁を控えめに混ぜつつ、基本は丁寧語`,
    getting_close: `「〜やね」「〜やで」「〜ちゃう?」などやわらかい関西弁を時々混ぜる`,
    close: `「〜やん」「〜やで」「〜やろ?」「〜してみい」など親しみある関西弁メイン`,
    family: `「〜やんか!」「〜やで!」「〜してみ?」「ほんま」「めっちゃ」など気の置けない関西弁全開`,
  };
  const standardSamples = {
    new: `丁寧な敬語で話す(「〜ですね」「〜ましょう」「〜と思いますよ」)`,
    getting_close: `基本は敬語、時々「〜だね」「〜だよ」などのやわらかい表現も混ぜる`,
    close: `タメ口メインだが時々丁寧語も混じる(「〜だよ」「〜してみて」「〜だね!」、たまに「〜ですね」)`,
    family: `親しい友人のような完全タメ口(「〜してね」「〜だよ」「〜でしょ?」「〜じゃん」)`,
  };
  const samples = dialect === "kansai" ? kansaiSamples : standardSamples;
  const dialectLabel = dialect === "kansai" ? "(関西弁)" : "";

  switch (level) {
    case "new":
      return `【関係性レベル: 初対面(${days}日目)${dialectLabel}】
- ${samples.new}
- 初対面の誠実さと、専門家としての頼もしさを大切に
- 名前で呼ぶときは「${name}さん」
- 温かく寄り添いつつも、距離感を保つ`;
    case "getting_close":
      return `【関係性レベル: 打ち解けてきた頃(${days}日目)${dialectLabel}】
- ${samples.getting_close}
- 名前で呼ぶときは「${name}さん」
- 「継続していて素晴らしい」という気持ちを自然に伝える
- 前回・前々回のデータに触れて「覚えていますよ」感を出す`;
    case "close":
      return `【関係性レベル: タメ口に切り替わる時期(${days}日目)${dialectLabel}】
- ${samples.close}
- 1週間以上続けてくれた仲間として、敬語からタメ口へ自然に移行
- 「${name}さん、」と親しみを込めて呼ぶ(さん付けは継続)
- ${days}日続けてきたユーザーへの敬意と親しみを表現
- ユーザーの傾向を深く理解している口ぶり(「${name}さんはいつも夕方に肩がつらくなるよね」等)`;
    case "family":
      return `【関係性レベル: 気の置けない関係(${days}日目)${dialectLabel}】
- ${samples.family}
- 「${name}さん、」と親しみを込めて呼ぶ
- これまでの変化を一緒に喜ぶ。応援の言葉を惜しまない
- ユーザーの体のクセ・生活パターン・好みをすべて把握している前提で話す`;
  }
}

async function buildUserContext(deviceId: string, dialect: Dialect = "standard"): Promise<UserContextResult> {
  const EMPTY: UserContextResult = {
    contextText: "",
    latestPostureImageUrl: null,
    latestPostureDate: null,
    latestPostureDaysAgo: null,
    firstPostureImageUrl: null,
    firstPostureDate: null,
    firstPostureDaysAgo: null,
    latestMealImageUrl: null,
    latestMealInfo: null,
    relationshipLevel: "new",
    daysSinceRegistration: 0,
    userName: null,
  };
  if (!deviceId) return EMPTY;
  const supabase = getSupabase();
  const { data: users } = await supabase
    .from("users")
    .select("id, name, age, height_cm, weight_kg, gender, activity_level, created_at")
    .eq("device_id", deviceId);
  if (!users || users.length === 0) return EMPTY;
  const user = users[0];
  const userId = user.id;

  // 登録からの経過日数・関係性レベル
  const daysSinceRegistration = user.created_at
    ? Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))
    : 0;
  const relationshipLevel = calcRelationshipLevel(daysSinceRegistration);

  // 過去7日間の食事履歴も取得（ガイコツ先生が食事×姿勢を総合判断）
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [symptomRes, postureRes, firstPostureRes, chatRes, mealRes, goalRes] =
    await Promise.all([
      supabase
        .from("symptom_selections")
        .select("symptom_id, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("posture_records")
        .select("diagnosis, image_url, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(5),
      // Before/After比較用: 画像あり一番古い記録（独立クエリ）
      supabase
        .from("posture_records")
        .select("image_url, created_at")
        .eq("user_id", userId)
        .not("image_url", "is", null)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("chat_logs")
        .select("role, content, recommended_symptom, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("meal_records")
        .select("menu_name, meal_type, calories, protein_g, carbs_g, fat_g, score, advice, image_url, created_at")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("nutrition_goals")
        .select("goal_type, target_calories, target_protein_g, target_weight_kg, target_period_weeks")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

  const parts: string[] = [];

  const symptoms = symptomRes.data || [];
  if (symptoms.length > 0) {
    const counts: Record<string, number> = {};
    symptoms.forEach((s) => {
      counts[s.symptom_id] = (counts[s.symptom_id] || 0) + 1;
    });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const trend = sorted.map(([id, c]) => `${SYMPTOM_LABELS[id] || id}(${c}回)`).join("、");
    parts.push(`【過去の症状傾向】${trend}`);
  }

  // 最新の姿勢写真URL（vision用）
  let latestPostureImageUrl: string | null = null;
  let latestPostureDate: string | null = null;
  let latestPostureDaysAgo: number | null = null;
  let firstPostureImageUrl: string | null = null;
  let firstPostureDate: string | null = null;
  let firstPostureDaysAgo: number | null = null;

  const postures = postureRes.data || [];
  if (postures.length > 0) {
    const latest = postures[0];
    if (latest.image_url && latest.image_url.startsWith("http")) {
      latestPostureImageUrl = latest.image_url;
      latestPostureDate = new Date(latest.created_at).toLocaleDateString("ja-JP");
      // 写真が撮影されてから何日経過したか（時間単位の差で計算）
      const diffMs = Date.now() - new Date(latest.created_at).getTime();
      latestPostureDaysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
    const diag = Array.isArray(latest.diagnosis) ? latest.diagnosis : [];
    const issues = diag
      .filter((d: { level: string }) => d.level !== "good")
      .map((d: { label: string; message: string }) => `${d.label}: ${d.message}`);
    if (issues.length > 0) {
      const date = new Date(latest.created_at).toLocaleDateString("ja-JP");
      parts.push(`【直近の姿勢診断(${date})】${issues.join("、")}`);
    }

    // Before/After比較用に一番古い画像ありレコードを使う（独立クエリの結果）
    const firstPosture = firstPostureRes.data;
    if (
      firstPosture &&
      firstPosture.image_url &&
      typeof firstPosture.image_url === "string" &&
      firstPosture.image_url.startsWith("http") &&
      firstPosture.image_url !== latestPostureImageUrl
    ) {
      firstPostureImageUrl = firstPosture.image_url;
      firstPostureDate = new Date(firstPosture.created_at).toLocaleDateString("ja-JP");
      const diffMs = Date.now() - new Date(firstPosture.created_at).getTime();
      firstPostureDaysAgo = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    }
  }

  const chats = chatRes.data || [];
  const userChats = chats.filter((c) => c.role === "user").slice(0, 3);
  if (userChats.length > 0) {
    const topics = userChats.map((c) => c.content.slice(0, 40)).join(" / ");
    parts.push(`【過去の相談内容】${topics}`);
  }

  // 過去7日間の食事データを整形
  const meals = mealRes.data || [];

  // 最新食事の画像URL＋経過時間を保持（24時間以内のみ）
  let latestMealImageUrl: string | null = null;
  let latestMealInfo: UserContextResult["latestMealInfo"] = null;
  if (meals.length > 0) {
    const latestMeal = meals[0];
    if (latestMeal.image_url && latestMeal.image_url.startsWith("http")) {
      const hoursAgo = Math.floor(
        (Date.now() - new Date(latestMeal.created_at).getTime()) / (1000 * 60 * 60)
      );
      if (hoursAgo <= 24) {
        latestMealImageUrl = latestMeal.image_url;
        latestMealInfo = {
          mealType: latestMeal.meal_type,
          menuName: latestMeal.menu_name,
          calories: latestMeal.calories,
          hoursAgo,
        };
      }
    }
  }

  if (meals.length > 0) {
    // 日別にグループ化
    const byDate: Record<string, { menu: string[]; totalCal: number; totalProtein: number; scores: number[] }> = {};
    meals.forEach((m) => {
      const d = new Date(m.created_at).toLocaleDateString("ja-JP", {
        month: "numeric",
        day: "numeric",
      });
      if (!byDate[d]) byDate[d] = { menu: [], totalCal: 0, totalProtein: 0, scores: [] };
      if (m.menu_name) byDate[d].menu.push(m.menu_name);
      if (m.calories) byDate[d].totalCal += m.calories;
      if (m.protein_g) byDate[d].totalProtein += Number(m.protein_g);
      if (m.score) byDate[d].scores.push(m.score);
    });

    const mealLines = Object.entries(byDate)
      .slice(0, 7)
      .map(([date, data]) => {
        const avgScore =
          data.scores.length > 0
            ? Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length)
            : 0;
        return `${date}: ${data.menu.slice(0, 3).join("/")} (計${data.totalCal}kcal / P${data.totalProtein.toFixed(0)}g / 平均スコア${avgScore})`;
      })
      .join("\n");

    // 平均カロリー
    const totalDays = Object.keys(byDate).length;
    const totalCal = Object.values(byDate).reduce((s, d) => s + d.totalCal, 0);
    const avgCal = totalDays > 0 ? Math.round(totalCal / totalDays) : 0;
    const totalProtein = Object.values(byDate).reduce((s, d) => s + d.totalProtein, 0);
    const avgProtein = totalDays > 0 ? (totalProtein / totalDays).toFixed(1) : "0";

    parts.push(
      `【過去7日間の食事記録(${meals.length}件)】\n${mealLines}\n1日平均: ${avgCal}kcal / タンパク質${avgProtein}g`
    );

    // 最新食事の詳細（直近24時間以内）
    if (latestMealInfo) {
      const mt = latestMealInfo.mealType || "食事";
      const menu = latestMealInfo.menuName || "(メニュー不明)";
      const cal = latestMealInfo.calories || 0;
      parts.push(
        `【最新の食事（${latestMealInfo.hoursAgo}時間前）】${mt}: ${menu} / ${cal}kcal`
      );
    }
  }

  // 栄養目標
  const goal = goalRes.data;
  if (goal) {
    const goalInfo = GOAL_LABELS[goal.goal_type as GoalType];
    const goalLabel = goalInfo ? `${goalInfo.emoji} ${goalInfo.label}` : goal.goal_type;
    parts.push(
      `【ユーザーの栄養目標】${goalLabel} / 目標カロリー${goal.target_calories}kcal / タンパク質${goal.target_protein_g}g`
    );
  }

  // ユーザーの身体プロフィール（プロフィール完成時のみ）
  if (
    user.height_cm &&
    user.weight_kg &&
    user.gender &&
    user.activity_level &&
    user.age
  ) {
    const rec = calculateRecommendation({
      gender: user.gender as Gender,
      heightCm: user.height_cm,
      weightKg: Number(user.weight_kg),
      age: user.age,
      activityLevel: user.activity_level as ActivityLevel,
      goalType: (goal?.goal_type as GoalType) || "maintain",
      targetWeightKg: goal?.target_weight_kg ? Number(goal.target_weight_kg) : undefined,
      targetPeriodWeeks: goal?.target_period_weeks || undefined,
    });

    const activityInfo = ACTIVITY_LABELS[user.activity_level as ActivityLevel];
    parts.push(
      `【ユーザーの身体情報】${GENDER_LABELS[user.gender as Gender]} / ${user.age}歳 / 身長${user.height_cm}cm / 体重${user.weight_kg}kg / 活動レベル: ${activityInfo?.label || user.activity_level}
BMI: ${rec.bmi}（${rec.bmiCategory}）/ 基礎代謝: ${rec.bmr}kcal / 1日総消費: ${rec.tdee}kcal
科学的に最適な推奨値: ${rec.recommendedCalories}kcal / タンパク質${rec.recommendedProteinG}g / 炭水化物${rec.recommendedCarbsG}g / 脂質${rec.recommendedFatG}g`
    );
  }

  const relationshipBlock = relationshipInstruction(
    relationshipLevel,
    user.name,
    daysSinceRegistration,
    dialect
  );

  const contextText =
    parts.length === 0
      ? `\n\n${relationshipBlock}`
      : `\n\n${relationshipBlock}\n\n【このユーザーの過去データ】\nこのユーザーはリピーターです。過去のデータを参考にして、より的確なアドバイスをしてください。\n${parts.join("\n")}\n\n【食事×姿勢×痛みの総合アドバイスについて】\n上記の食事データがある場合は、食事内容と姿勢・痛みの関連性にも触れてください。例: タンパク質不足→筋肉量低下→姿勢悪化、糖質過多→炎症→慢性痛、カフェイン摂取→交感神経優位→肩こり悪化 など。ただし専門用語ではなく日常語で説明してください。\n\n【パーソナル対応について】\n身体情報（身長・体重・年齢）と推奨値がある場合は、必ずそれを踏まえた個別アドバイスをしてください。「あなたの場合は〇〇kcalが目安です」「タンパク質が〇g足りていません」など具体的に。体重や年齢の話題は相手を傷つけないよう配慮しつつ、プロフェッショナルな助言を心がけてください。`;

  return {
    contextText,
    latestPostureImageUrl,
    latestPostureDate,
    latestPostureDaysAgo,
    firstPostureImageUrl,
    firstPostureDate,
    firstPostureDaysAgo,
    latestMealImageUrl,
    latestMealInfo,
    relationshipLevel,
    daysSinceRegistration,
    userName: user.name || null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      deviceId,
      consultMeal,
      attachedPhotoUrl,  // ユーザーがチャット中に撮影してアップロードした写真URL
      compareMode,       // Before/After比較モード（初回写真と最新写真の両方を送る）
      dialect,           // 口調設定: "standard" | "kansai" (デフォルト: "standard")
      characterId,       // キャラクター: "kentaro" | "honemi" | "honeta" | "koturi"
    } = await req.json();
    const dialectSafe: Dialect = dialect === "kansai" ? "kansai" : "standard";
    const character = getCharacterById(characterId);

    // 利用制限チェック（ユーザーメッセージ=初回以外をカウント）
    const isFirst = !messages || messages.length === 0;
    if (!isFirst && deviceId) {
      const supabase = getSupabase();
      const userId = await getUserIdByDeviceId(supabase, deviceId);
      if (userId) {
        const limitCheck = await checkAndIncrementUsage(
          supabase,
          userId,
          "chat"
        );
        if (!limitCheck.allowed) {
          return new Response(
            JSON.stringify({
              error: "limit_reached",
              feature: "chat",
              usage: limitCheck.usage,
              limit: limitCheck.limit,
              message: `無料プランのAIチャットは月${limitCheck.limit}回までです。無制限にするには有料プランにアップグレードしてください。`,
            }),
            {
              status: 402,
              headers: { "Content-Type": "application/json" },
            }
          );
        }
      }
    }

    const {
      contextText,
      latestPostureImageUrl,
      latestPostureDate,
      latestPostureDaysAgo,
      firstPostureImageUrl,
      firstPostureDate,
      firstPostureDaysAgo,
      latestMealImageUrl,
      latestMealInfo,
    } = await buildUserContext(deviceId || "", dialectSafe);
    const systemPrompt = buildBasePrompt(character) + STRETCH_CATALOG_PROMPT + buildAvailableImagesForPrompt() + contextText;

    const isFirstMessage = !messages || messages.length === 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let apiMessages: any[];

    // ========= Claude Vision 用に Signed URL に変換（Privateバケット対応） =========
    const supabaseForSign = getSupabase();
    const [
      signedLatestPostureUrl,
      signedFirstPostureUrl,
      signedLatestMealUrl,
      signedAttachedPhotoUrl,
    ] = await Promise.all([
      getSignedImageUrl(supabaseForSign, latestPostureImageUrl, "posture-images"),
      getSignedImageUrl(supabaseForSign, firstPostureImageUrl, "posture-images"),
      getSignedImageUrl(supabaseForSign, latestMealImageUrl, "meal-images"),
      typeof attachedPhotoUrl === "string" && attachedPhotoUrl.startsWith("http")
        ? getSignedImageUrl(supabaseForSign, attachedPhotoUrl, "posture-images")
        : Promise.resolve(null),
    ]);

    // ========= 優先順位: compareMode > attachedPhotoUrl > 食事相談 > 自動添付 =========

    // Before/After 比較モード（ユーザーが明示的にリクエスト）
    const shouldCompare =
      compareMode === true && signedFirstPostureUrl && signedLatestPostureUrl;

    // ユーザーが直接アップロードした写真
    const hasAttachedPhoto =
      typeof signedAttachedPhotoUrl === "string" &&
      signedAttachedPhotoUrl.startsWith("http");

    // 食事相談モード: 食事画面から遷移してきた場合、食事写真を優先して添付
    const shouldAttachMeal =
      !shouldCompare &&
      !hasAttachedPhoto &&
      isFirstMessage &&
      consultMeal === true &&
      signedLatestMealUrl;

    // 姿勢写真が「3日以内に撮影された最新のもの」のみ自動添付
    const shouldAttachPhoto =
      !shouldCompare &&
      !hasAttachedPhoto &&
      !shouldAttachMeal &&
      isFirstMessage &&
      signedLatestPostureUrl &&
      latestPostureDaysAgo !== null &&
      latestPostureDaysAgo <= 3;

    if (shouldCompare && signedFirstPostureUrl && signedLatestPostureUrl) {
      // Before/After比較: 初回写真と最新写真の両方を送る
      const firstDaysText =
        firstPostureDaysAgo !== null && firstPostureDaysAgo > 0
          ? `${firstPostureDaysAgo}日前（${firstPostureDate}）`
          : firstPostureDate || "初回";
      const latestDaysText =
        latestPostureDaysAgo === 0
          ? "今日"
          : latestPostureDaysAgo === 1
          ? "昨日"
          : `${latestPostureDaysAgo}日前（${latestPostureDate}）`;

      const userPrompt =
        messages && messages.length > 0
          ? messages[messages.length - 1]?.content ||
            "最初の姿勢と最新の姿勢を比べて変化を教えてください。"
          : "最初の姿勢と最新の姿勢を比べて変化を教えてください。";
      const introText = `【比較分析リクエスト】1枚目: ${firstDaysText}撮影のBefore写真、2枚目: ${latestDaysText}撮影のAfter写真です。両方の姿勢写真を見比べて、具体的な変化と改善点・まだ気になる点を分析してください。\n\nユーザーの質問: ${userPrompt}`;

      // 既存メッセージがあればそれを維持しつつ、最後のメッセージに画像を注入
      const baseMessages =
        messages && messages.length > 0
          ? messages.slice(0, -1)
          : [];
      apiMessages = [
        ...baseMessages,
        {
          role: "user" as const,
          content: [
            {
              type: "image",
              source: { type: "url", url: signedFirstPostureUrl },
            },
            {
              type: "image",
              source: { type: "url", url: signedLatestPostureUrl },
            },
            {
              type: "text",
              text: introText,
            },
          ],
        },
      ];
    } else if (hasAttachedPhoto) {
      // ユーザー添付写真: 最後のメッセージに画像を添付
      const baseMessages =
        messages && messages.length > 0
          ? messages.slice(0, -1)
          : [];
      const userText =
        messages && messages.length > 0
          ? messages[messages.length - 1]?.content ||
            "今撮影した姿勢を見てください。"
          : "今撮影した姿勢を見てください。";
      apiMessages = [
        ...baseMessages,
        {
          role: "user" as const,
          content: [
            {
              type: "image",
              source: { type: "url", url: signedAttachedPhotoUrl },
            },
            {
              type: "text",
              text: `【今撮影した姿勢写真】\n${userText}\n\n（この写真は今ちょうど撮影したばかりの新しい姿勢です。視覚的に分析してアドバイスをお願いします）`,
            },
          ],
        },
      ];
    } else if (shouldAttachMeal && signedLatestMealUrl && latestMealInfo) {
      // 食事相談モード: 食事写真を添付して、食事について聞く前提で始める
      const mt = latestMealInfo.mealType || "食事";
      const menu = latestMealInfo.menuName || "この食事";
      const cal = latestMealInfo.calories || 0;
      const timeAgo =
        latestMealInfo.hoursAgo === 0
          ? "先ほど"
          : `${latestMealInfo.hoursAgo}時間前`;
      const introText = `${timeAgo}撮影した${mt}（${menu} / ${cal}kcal）について相談したいです。写真を見て、栄養バランスや姿勢・体への影響、次の食事のおすすめなどアドバイスをお願いします。`;

      apiMessages = [
        {
          role: "user" as const,
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: signedLatestMealUrl,
              },
            },
            {
              type: "text",
              text: introText,
            },
          ],
        },
      ];
    } else if (shouldAttachPhoto && signedLatestPostureUrl) {
      // 写真の経過日数で初回メッセージを出し分ける
      let introText: string;
      if (latestPostureDaysAgo === 0) {
        introText = `こんにちは。今日撮影した姿勢写真です。気になる点があれば教えてください。`;
      } else if (latestPostureDaysAgo === 1) {
        introText = `こんにちは。昨日撮影した姿勢写真を見ていただけますか？`;
      } else {
        introText = `こんにちは。${latestPostureDaysAgo}日前（${latestPostureDate}）に撮影した姿勢写真を見ていただけますか？`;
      }

      apiMessages = [
        {
          role: "user" as const,
          content: [
            {
              type: "image",
              source: {
                type: "url",
                url: signedLatestPostureUrl,
              },
            },
            {
              type: "text",
              text: introText,
            },
          ],
        },
      ];
    } else if (isFirstMessage) {
      // 写真なし or 古すぎる場合は普通の挨拶のみ
      // ガイコツ先生は写真の話題に触れずに自然な挨拶から始める
      const greeting =
        latestPostureDaysAgo !== null && latestPostureDaysAgo > 3
          ? `こんにちは、相談したいです。（前回の姿勢チェックから${latestPostureDaysAgo}日経ちました）`
          : "こんにちは、相談したいです。";
      apiMessages = [{ role: "user" as const, content: greeting }];
    } else {
      apiMessages = messages;
    }

    const client = getClient();

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        let fullText = "";
        // ====== iOS Safari 対策: 冒頭パディング ======
        // iOS は text/event-stream の最初の数KBをバッファに溜める性質があり、
        // 最初のトークンが届くまで「無応答」に見える。コメント行で 2KB 強を
        // 即送信してバッファを強制フラッシュ。
        const padding = `:${" ".repeat(2048)}\n\n`;
        controller.enqueue(encoder.encode(padding));
        controller.enqueue(encoder.encode(`: open\n\n`));

        // ====== 5秒ごとにハートビートを送る（接続維持） ======
        const heartbeat = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          } catch {
            /* controller closed */
          }
        }, 5000);

        try {
          const stream = client.messages.stream({
            model: "claude-sonnet-4-20250514",
            max_tokens: 800,
            system: systemPrompt,
            messages: apiMessages,
          });

          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullText += text;
              // recommendationタグはストリーミングしない（最後に処理）
              const cleanedChunk = text;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: cleanedChunk })}\n\n`)
              );
            }
          }

          // recommendation抽出
          const match = fullText.match(/<recommendation>\s*(\{.*?\})\s*<\/recommendation>/);
          let recommendedSymptomId: string | null = null;
          let cleanText = fullText;
          if (match) {
            try {
              const parsed = JSON.parse(match[1]);
              recommendedSymptomId = parsed.symptomId;
            } catch { /* ignore */ }
            cleanText = fullText.replace(/<recommendation>[\s\S]*?<\/recommendation>/, "").trim();
          }

          // 完了通知
          clearInterval(heartbeat);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                done: true,
                recommendedSymptomId,
                cleanText,
              })}\n\n`
            )
          );
          controller.close();
        } catch (e) {
          clearInterval(heartbeat);
          const msg = e instanceof Error ? e.message : String(e);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (e) {
    console.error("Chat API error:", e);
    return new Response(
      JSON.stringify({ error: "AIとの通信に失敗しました" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
