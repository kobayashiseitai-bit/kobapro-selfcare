import { Landmark, DiagnosisItem } from "./storage";

const NOSE = 0;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

// ===== カメラ左右反転補正 =====
// フロントカメラは鏡像表示のため、MediaPipeの「左肩」は実際の「右肩」になる
// 全ての左右ペアを入れ替え + X座標を反転することで解剖学的な左右を正しく判定
const LEFT_RIGHT_PAIRS: [number, number][] = [
  [1, 4], [2, 5], [3, 6], // 目
  [7, 8], // 耳
  [9, 10], // 口
  [11, 12], // 肩
  [13, 14], // 肘
  [15, 16], // 手首
  [17, 18], [19, 20], [21, 22], // 手
  [23, 24], // 腰
  [25, 26], // 膝
  [27, 28], // 足首
  [29, 30], [31, 32], // 足
];

function mirrorLandmarks(landmarks: Landmark[]): Landmark[] {
  const mirrored = landmarks.map((l) => ({ ...l, x: 1 - l.x }));
  for (const [left, right] of LEFT_RIGHT_PAIRS) {
    if (left < mirrored.length && right < mirrored.length) {
      const tmp = mirrored[left];
      mirrored[left] = mirrored[right];
      mirrored[right] = tmp;
    }
  }
  return mirrored;
}

// ===== 厳格化されたしきい値 =====
const THRESHOLDS = {
  shoulder: { good: 0.008, caution: 0.020 },
  hip:      { good: 0.008, caution: 0.020 },
  head:     { good: 0.012, caution: 0.028 },
  knee:     { good: 0.010, caution: 0.025 },
  balance:  { good: 0.008, caution: 0.020 },
};

// 横向き用しきい値（角度ベース）
const SIDE_THRESHOLDS = {
  kyphosis:      { good: 15, caution: 25 },    // 猫背（度）
  roundShoulder: { good: 0.02, caution: 0.05 }, // 巻き肩
  pelvicTilt:    { good: 10, caution: 20 },      // 骨盤後傾（度）
  straightNeck:  { good: 0.02, caution: 0.04 },  // ストレートネック
};

function getLevel(diff: number, threshold: { good: number; caution: number }): "good" | "caution" | "bad" {
  const abs = Math.abs(diff);
  if (abs <= threshold.good) return "good";
  if (abs <= threshold.caution) return "caution";
  return "bad";
}

function diffToMessage(diff: number, threshold: { good: number }, leftLabel: string, rightLabel: string): string {
  if (Math.abs(diff) <= threshold.good) return "左右バランス良好です";
  return diff > 0 ? `${rightLabel}が下がっています` : `${leftLabel}が下がっています`;
}

function tiltToMessage(diff: number, threshold: { good: number }, label: string): string {
  if (Math.abs(diff) <= threshold.good) return `${label}は正常です`;
  return `${label}が${diff > 0 ? "右" : "左"}に傾いています`;
}

function diffToDegree(diff: number): number {
  return Math.round(Math.abs(diff) * 180 * 10) / 10;
}

// ===== フレーム平均化 =====
const FRAME_BUFFER_SIZE = 5;
let landmarkBuffer: Landmark[][] = [];

export function addLandmarkFrame(landmarks: Landmark[]): void {
  landmarkBuffer.push(landmarks.map(l => ({ ...l })));
  if (landmarkBuffer.length > FRAME_BUFFER_SIZE) landmarkBuffer.shift();
}

export function clearLandmarkBuffer(): void {
  landmarkBuffer = [];
}

function getAveragedLandmarks(): Landmark[] | null {
  if (landmarkBuffer.length < 3) return null;
  const numLm = landmarkBuffer[0].length;
  const averaged: Landmark[] = [];
  for (let i = 0; i < numLm; i++) {
    let sX = 0, sY = 0, sZ = 0, sV = 0;
    const c = landmarkBuffer.length;
    for (const frame of landmarkBuffer) {
      if (i < frame.length) { sX += frame[i].x; sY += frame[i].y; sZ += frame[i].z || 0; sV += frame[i].visibility || 0; }
    }
    averaged.push({ x: sX / c, y: sY / c, z: sZ / c, visibility: sV / c });
  }
  return averaged;
}

// ===== アドバイス =====
function shoulderAdvice(level: "good" | "caution" | "bad", diff: number): string {
  if (level === "good") return "肩のバランスが取れています。この状態をキープしましょう。";
  const side = diff > 0 ? "右" : "左"; const opp = diff > 0 ? "左" : "右";
  if (level === "caution") return `${side}肩がやや下がっています。${opp}側にカバンを持つ癖がないか確認してみましょう。`;
  return `${side}肩が大きく下がっています。僧帽筋のストレッチや、${opp}側の肩甲骨を意識したエクササイズがおすすめです。`;
}

function hipAdvice(level: "good" | "caution" | "bad", diff: number): string {
  if (level === "good") return "骨盤のバランスが良好です。";
  const side = diff > 0 ? "右" : "左";
  if (level === "caution") return `骨盤が${side}に傾いています。片足重心で立つ癖を意識して直しましょう。`;
  return `骨盤の歪みが大きいです。骨盤矯正のストレッチや、お尻の筋トレ（ヒップリフト等）を取り入れてみてください。`;
}

function headAdvice(level: "good" | "caution" | "bad", diff: number): string {
  if (level === "good") return "頭の位置が正常です。";
  const side = diff > 0 ? "右" : "左";
  if (level === "caution") return `頭が${side}に傾いています。スマホを見る姿勢に気をつけましょう。`;
  return `頭の傾きが大きいです。首のストレッチと、デスクワーク時のモニター位置を見直してみてください。`;
}

function kneeAdvice(level: "good" | "caution" | "bad"): string {
  if (level === "good") return "膝の高さが揃っています。";
  if (level === "caution") return "膝の高さにやや差があります。足を組む癖を控えましょう。";
  return "膝の左右差が大きいです。股関節周りのストレッチやスクワットで改善を目指しましょう。";
}

function balanceAdvice(level: "good" | "caution" | "bad", diff: number): string {
  if (level === "good") return "重心バランスが取れています。";
  const side = diff > 0 ? "右" : "左";
  if (level === "caution") return `重心が${side}に寄っています。両足に均等に体重を乗せることを意識しましょう。`;
  return `重心の偏りが大きいです。体幹トレーニング（プランク等）で体の軸を安定させましょう。`;
}

// ===== 正面撮影の解析（5項目） =====
export function analyzeFrontPosture(landmarks: Landmark[]): DiagnosisItem[] {
  if (landmarks.length < 33) return [];
  const raw = getAveragedLandmarks() || landmarks;
  // フロントカメラの鏡像反転を補正（解剖学的な左右に揃える）
  const lm = mirrorLandmarks(raw);
  const results: DiagnosisItem[] = [];

  const shoulderDiff = lm[LEFT_SHOULDER].y - lm[RIGHT_SHOULDER].y;
  const sLevel = getLevel(shoulderDiff, THRESHOLDS.shoulder);
  results.push({
    label: "肩の傾き", value: diffToDegree(shoulderDiff), unit: "°", level: sLevel,
    message: diffToMessage(shoulderDiff, THRESHOLDS.shoulder, "左肩", "右肩"),
    advice: shoulderAdvice(sLevel, shoulderDiff),
  });

  const hipDiff = lm[LEFT_HIP].y - lm[RIGHT_HIP].y;
  const hLevel = getLevel(hipDiff, THRESHOLDS.hip);
  results.push({
    label: "骨盤の傾き", value: diffToDegree(hipDiff), unit: "°", level: hLevel,
    message: diffToMessage(hipDiff, THRESHOLDS.hip, "左腰", "右腰"),
    advice: hipAdvice(hLevel, hipDiff),
  });

  const shoulderCenterX = (lm[LEFT_SHOULDER].x + lm[RIGHT_SHOULDER].x) / 2;
  const headTilt = lm[NOSE].x - shoulderCenterX;
  const headLevel = getLevel(headTilt, THRESHOLDS.head);
  results.push({
    label: "頭の傾き", value: diffToDegree(headTilt), unit: "°", level: headLevel,
    message: tiltToMessage(headTilt, THRESHOLDS.head, "頭"),
    advice: headAdvice(headLevel, headTilt),
  });

  const kneeDiff = lm[LEFT_KNEE].y - lm[RIGHT_KNEE].y;
  const kLevel = getLevel(kneeDiff, THRESHOLDS.knee);
  results.push({
    label: "膝の高さの差", value: diffToDegree(kneeDiff), unit: "°", level: kLevel,
    message: diffToMessage(kneeDiff, THRESHOLDS.knee, "左膝", "右膝"),
    advice: kneeAdvice(kLevel),
  });

  const hipCenterX = (lm[LEFT_HIP].x + lm[RIGHT_HIP].x) / 2;
  const balanceDiff = shoulderCenterX - hipCenterX;
  const bLevel = getLevel(balanceDiff, THRESHOLDS.balance);
  results.push({
    label: "重心バランス", value: diffToDegree(balanceDiff), unit: "°", level: bLevel,
    message: tiltToMessage(balanceDiff, THRESHOLDS.balance, "重心"),
    advice: balanceAdvice(bLevel, balanceDiff),
  });

  return results;
}

// ===== 横向き撮影の解析（4項目） =====
export function analyzeSidePosture(landmarks: Landmark[]): DiagnosisItem[] {
  if (landmarks.length < 33) return [];
  const lm = getAveragedLandmarks() || landmarks;
  const results: DiagnosisItem[] = [];

  // 横向き: X座標が前後方向、Y座標が上下方向になる
  const earX = ((lm[LEFT_EAR].x || 0) + (lm[RIGHT_EAR].x || 0)) / 2;
  const earY = ((lm[LEFT_EAR].y || 0) + (lm[RIGHT_EAR].y || 0)) / 2;
  const shoulderX = (lm[LEFT_SHOULDER].x + lm[RIGHT_SHOULDER].x) / 2;
  const shoulderY = (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2;
  const hipX = (lm[LEFT_HIP].x + lm[RIGHT_HIP].x) / 2;
  const hipY = (lm[LEFT_HIP].y + lm[RIGHT_HIP].y) / 2;
  const kneeX = (lm[LEFT_KNEE].x + lm[RIGHT_KNEE].x) / 2;
  const kneeY = (lm[LEFT_KNEE].y + lm[RIGHT_KNEE].y) / 2;

  // 1. 猫背角度: 耳-肩-腰のライン角度
  const earShoulderAngle = Math.atan2(shoulderY - earY, shoulderX - earX) * (180 / Math.PI);
  const shoulderHipAngle = Math.atan2(hipY - shoulderY, hipX - shoulderX) * (180 / Math.PI);
  const kyphosisAngle = Math.abs(earShoulderAngle - shoulderHipAngle);
  const kLevel = getLevel(kyphosisAngle, SIDE_THRESHOLDS.kyphosis);
  results.push({
    label: "猫背（背中の丸み）",
    value: Math.round(kyphosisAngle * 10) / 10,
    unit: "°",
    level: kLevel,
    message: kLevel === "good" ? "背筋がまっすぐです" : kLevel === "caution" ? "やや猫背傾向があります" : "猫背が目立ちます",
    advice: kLevel === "good"
      ? "背筋がしっかり伸びています。この姿勢を維持しましょう。"
      : kLevel === "caution"
      ? "背中がやや丸まっています。胸を張り、肩甲骨を寄せる意識をしましょう。"
      : "背中の丸みが大きいです。胸椎ストレッチや、キャット&カウのエクササイズがおすすめです。",
  });

  // 2. 巻き肩: 肩が耳より前にあるか
  const roundShoulderDiff = shoulderX - earX;
  const rsLevel = getLevel(roundShoulderDiff, SIDE_THRESHOLDS.roundShoulder);
  results.push({
    label: "巻き肩",
    value: Math.round(Math.abs(roundShoulderDiff) * 100) / 10,
    unit: "cm",
    level: rsLevel,
    message: rsLevel === "good" ? "肩の位置は正常です" : rsLevel === "caution" ? "やや巻き肩の傾向があります" : "巻き肩が見られます",
    advice: rsLevel === "good"
      ? "肩が自然な位置にあります。良い姿勢です。"
      : rsLevel === "caution"
      ? "肩がやや前に出ています。肩を後ろに引き、胸を開く意識をしましょう。"
      : "肩が前方に巻き込んでいます。大胸筋のストレッチと、背中の筋力強化がおすすめです。",
  });

  // 3. 骨盤後傾: 腰-膝のライン角度
  const hipKneeAngle = Math.atan2(kneeY - hipY, kneeX - hipX) * (180 / Math.PI);
  const pelvicTilt = Math.abs(hipKneeAngle - 90);
  const pLevel = getLevel(pelvicTilt, SIDE_THRESHOLDS.pelvicTilt);
  results.push({
    label: "骨盤の前後傾き",
    value: Math.round(pelvicTilt * 10) / 10,
    unit: "°",
    level: pLevel,
    message: pLevel === "good" ? "骨盤の角度は正常です" : pLevel === "caution" ? "骨盤がやや傾いています" : "骨盤の傾きが大きいです",
    advice: pLevel === "good"
      ? "骨盤が正しい角度で保たれています。"
      : pLevel === "caution"
      ? "骨盤がやや後傾しています。腸腰筋のストレッチと、ハムストリングスの柔軟性を高めましょう。"
      : "骨盤の後傾が目立ちます。骨盤前傾を意識したエクササイズや、座り姿勢の改善が必要です。",
  });

  // 4. ストレートネック: 耳と肩のX座標差（横から見て耳が前に出ているか）
  const neckForward = earX - shoulderX;
  const nLevel = getLevel(Math.abs(neckForward), SIDE_THRESHOLDS.straightNeck);
  results.push({
    label: "ストレートネック",
    value: Math.round(Math.abs(neckForward) * 100) / 10,
    unit: "cm",
    level: nLevel,
    message: nLevel === "good" ? "首の位置は正常です" : nLevel === "caution" ? "首がやや前に出ています" : "首が大きく前に出ています",
    advice: nLevel === "good"
      ? "首が肩の真上にあり、正しい位置です。"
      : nLevel === "caution"
      ? "首が前方に出がちです。スマホやPCの画面を目の高さに合わせましょう。"
      : "ストレートネックの傾向が強いです。首の後屈ストレッチ、あご引き体操を毎日行いましょう。",
  });

  return results;
}

// ===== 後方互換: 正面のみ（旧API） =====
export function analyzePosture(landmarks: Landmark[]): DiagnosisItem[] {
  return analyzeFrontPosture(landmarks);
}

// ===== 描画 =====
export function drawDiagnosisOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number
): void {
  if (landmarks.length < 33) return;
  const lm = getAveragedLandmarks() || landmarks;

  const toPixel = (l: Landmark) => ({ x: l.x * canvasWidth, y: l.y * canvasHeight });

  const lShoulder = toPixel(lm[LEFT_SHOULDER]);
  const rShoulder = toPixel(lm[RIGHT_SHOULDER]);
  const lHip = toPixel(lm[LEFT_HIP]);
  const rHip = toPixel(lm[RIGHT_HIP]);
  const nose = toPixel(lm[NOSE]);
  const lKnee = toPixel(lm[LEFT_KNEE]);
  const rKnee = toPixel(lm[RIGHT_KNEE]);
  const lAnkle = toPixel(lm[LEFT_ANKLE]);
  const rAnkle = toPixel(lm[RIGHT_ANKLE]);

  ctx.lineWidth = 3;
  ctx.font = "bold 14px sans-serif";

  const shoulderDiff = Math.abs(lm[LEFT_SHOULDER].y - lm[RIGHT_SHOULDER].y);
  drawHorizontalLine(ctx, lShoulder, rShoulder, shoulderDiff, THRESHOLDS.shoulder, "肩");

  const hipDiff = Math.abs(lm[LEFT_HIP].y - lm[RIGHT_HIP].y);
  drawHorizontalLine(ctx, lHip, rHip, hipDiff, THRESHOLDS.hip, "骨盤");

  const shoulderCenter = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
  const hipCenter = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.moveTo(shoulderCenter.x, nose.y - 30);
  ctx.lineTo(shoulderCenter.x, (lAnkle.y + rAnkle.y) / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const balanceDiff = Math.abs(shoulderCenter.x - hipCenter.x);
  const balanceLevel = getLevel(balanceDiff / canvasWidth, THRESHOLDS.balance);
  ctx.strokeStyle = levelColor(balanceLevel);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(nose.x, nose.y);
  ctx.lineTo(shoulderCenter.x, shoulderCenter.y);
  ctx.lineTo(hipCenter.x, hipCenter.y);
  ctx.lineTo((lKnee.x + rKnee.x) / 2, (lKnee.y + rKnee.y) / 2);
  ctx.stroke();
}

// 横向き用の描画
export function drawSideDiagnosisOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number
): void {
  if (landmarks.length < 33) return;
  const lm = getAveragedLandmarks() || landmarks;
  const toPixel = (l: Landmark) => ({ x: l.x * canvasWidth, y: l.y * canvasHeight });

  const ear = toPixel({ x: (lm[LEFT_EAR].x + lm[RIGHT_EAR].x) / 2, y: (lm[LEFT_EAR].y + lm[RIGHT_EAR].y) / 2, z: 0 });
  const shoulder = toPixel({ x: (lm[LEFT_SHOULDER].x + lm[RIGHT_SHOULDER].x) / 2, y: (lm[LEFT_SHOULDER].y + lm[RIGHT_SHOULDER].y) / 2, z: 0 });
  const hip = toPixel({ x: (lm[LEFT_HIP].x + lm[RIGHT_HIP].x) / 2, y: (lm[LEFT_HIP].y + lm[RIGHT_HIP].y) / 2, z: 0 });
  const knee = toPixel({ x: (lm[LEFT_KNEE].x + lm[RIGHT_KNEE].x) / 2, y: (lm[LEFT_KNEE].y + lm[RIGHT_KNEE].y) / 2, z: 0 });
  const ankle = toPixel({ x: (lm[LEFT_ANKLE].x + lm[RIGHT_ANKLE].x) / 2, y: (lm[LEFT_ANKLE].y + lm[RIGHT_ANKLE].y) / 2, z: 0 });

  // 姿勢ライン（耳→肩→腰→膝→足首）
  ctx.strokeStyle = "#60a5fa";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(ear.x, ear.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.lineTo(hip.x, hip.y);
  ctx.lineTo(knee.x, knee.y);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.stroke();

  // 理想的な垂直線
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ankle.x, ear.y - 20);
  ctx.lineTo(ankle.x, ankle.y + 10);
  ctx.stroke();
  ctx.setLineDash([]);

  // ポイントを描画
  [ear, shoulder, hip, knee, ankle].forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#60a5fa";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // ラベル
  ctx.font = "bold 12px sans-serif";
  ctx.fillStyle = "#fff";
  ctx.fillText("耳", ear.x + 10, ear.y);
  ctx.fillText("肩", shoulder.x + 10, shoulder.y);
  ctx.fillText("腰", hip.x + 10, hip.y);
  ctx.fillText("膝", knee.x + 10, knee.y);
}

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D, left: { x: number; y: number }, right: { x: number; y: number },
  diff: number, threshold: { good: number; caution: number }, label: string
): void {
  const level = getLevel(diff, threshold);
  const color = levelColor(level);
  ctx.strokeStyle = color; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(left.x, left.y); ctx.lineTo(right.x, right.y); ctx.stroke();
  const avgY = (left.y + right.y) / 2;
  ctx.setLineDash([5, 5]); ctx.strokeStyle = "rgba(255, 255, 255, 0.3)"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(left.x - 20, avgY); ctx.lineTo(right.x + 20, avgY); ctx.stroke();
  ctx.setLineDash([]);
  if (level !== "good") { ctx.fillStyle = color; ctx.fillText(label, right.x + 10, right.y); }
}

function levelColor(level: "good" | "caution" | "bad"): string {
  switch (level) { case "good": return "#22c55e"; case "caution": return "#eab308"; case "bad": return "#ef4444"; }
}
