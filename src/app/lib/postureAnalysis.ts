import { Landmark, DiagnosisItem } from "./storage";

const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const LEFT_EAR = 7;
const RIGHT_EAR = 8;

// 部位別しきい値（統一しきい値より正確）
const THRESHOLDS = {
  shoulder: { good: 0.012, caution: 0.030 },  // 肩: 敏感
  hip:      { good: 0.012, caution: 0.030 },  // 骨盤: 敏感
  head:     { good: 0.018, caution: 0.040 },  // 頭: やや余裕
  knee:     { good: 0.015, caution: 0.035 },  // 膝: 標準
  balance:  { good: 0.012, caution: 0.028 },  // 重心: 敏感
  forward:  { good: 0.02,  caution: 0.05  },  // 前傾: Z座標用
};

function getLevel(diff: number, threshold: { good: number; caution: number }): "good" | "caution" | "bad" {
  const abs = Math.abs(diff);
  if (abs <= threshold.good) return "good";
  if (abs <= threshold.caution) return "caution";
  return "bad";
}

function diffToMessage(diff: number, threshold: { good: number }, leftLabel: string, rightLabel: string): string {
  if (Math.abs(diff) <= threshold.good) return "左右バランス良好です";
  const direction = diff > 0 ? rightLabel : leftLabel;
  return `${direction}が下がっています`;
}

function tiltToMessage(diff: number, threshold: { good: number }, label: string): string {
  if (Math.abs(diff) <= threshold.good) return `${label}は正常です`;
  const direction = diff > 0 ? "右" : "左";
  return `${label}が${direction}に傾いています`;
}

function diffToDegree(diff: number): number {
  return Math.round(Math.abs(diff) * 180 * 10) / 10;
}

// ===== フレーム平均化 =====
const FRAME_BUFFER_SIZE = 5;
let landmarkBuffer: Landmark[][] = [];

export function addLandmarkFrame(landmarks: Landmark[]): void {
  landmarkBuffer.push(landmarks.map(l => ({ ...l })));
  if (landmarkBuffer.length > FRAME_BUFFER_SIZE) {
    landmarkBuffer.shift();
  }
}

export function clearLandmarkBuffer(): void {
  landmarkBuffer = [];
}

function getAveragedLandmarks(): Landmark[] | null {
  if (landmarkBuffer.length < 3) return null;
  const numLandmarks = landmarkBuffer[0].length;
  const averaged: Landmark[] = [];
  for (let i = 0; i < numLandmarks; i++) {
    let sumX = 0, sumY = 0, sumZ = 0, sumVis = 0;
    const count = landmarkBuffer.length;
    for (const frame of landmarkBuffer) {
      if (i < frame.length) {
        sumX += frame[i].x;
        sumY += frame[i].y;
        sumZ += frame[i].z || 0;
        sumVis += frame[i].visibility || 0;
      }
    }
    averaged.push({
      x: sumX / count,
      y: sumY / count,
      z: sumZ / count,
      visibility: sumVis / count,
    });
  }
  return averaged;
}

// ===== アドバイス生成 =====
function shoulderAdvice(level: "good" | "caution" | "bad", diff: number): string {
  if (level === "good") return "肩のバランスが取れています。この状態をキープしましょう。";
  const side = diff > 0 ? "右" : "左";
  const opposite = diff > 0 ? "左" : "右";
  if (level === "caution") return `${side}肩がやや下がっています。${opposite}側にカバンを持つ癖がないか確認してみましょう。`;
  return `${side}肩が大きく下がっています。僧帽筋のストレッチや、${opposite}側の肩甲骨を意識したエクササイズがおすすめです。`;
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

function forwardAdvice(level: "good" | "caution" | "bad"): string {
  if (level === "good") return "前後バランスが良好です。正しい姿勢が保てています。";
  if (level === "caution") return "やや前傾姿勢（猫背）気味です。胸を張り、肩を後ろに引くことを意識しましょう。";
  return "前傾姿勢（猫背）が目立ちます。背筋を伸ばすストレッチや、胸椎の可動性を高めるエクササイズをおすすめします。";
}

// ===== メイン解析関数 =====
export function analyzePosture(landmarks: Landmark[]): DiagnosisItem[] {
  if (landmarks.length < 33) return [];

  // フレーム平均化されたランドマークを使用（あれば）
  const lm = getAveragedLandmarks() || landmarks;
  const results: DiagnosisItem[] = [];

  // 1. 肩の傾き
  const shoulderDiff = lm[LEFT_SHOULDER].y - lm[RIGHT_SHOULDER].y;
  const sLevel = getLevel(shoulderDiff, THRESHOLDS.shoulder);
  results.push({
    label: "肩の傾き",
    value: diffToDegree(shoulderDiff),
    unit: "°",
    level: sLevel,
    message: diffToMessage(shoulderDiff, THRESHOLDS.shoulder, "左肩", "右肩"),
    advice: shoulderAdvice(sLevel, shoulderDiff),
  });

  // 2. 骨盤の傾き
  const hipDiff = lm[LEFT_HIP].y - lm[RIGHT_HIP].y;
  const hLevel = getLevel(hipDiff, THRESHOLDS.hip);
  results.push({
    label: "骨盤の傾き",
    value: diffToDegree(hipDiff),
    unit: "°",
    level: hLevel,
    message: diffToMessage(hipDiff, THRESHOLDS.hip, "左腰", "右腰"),
    advice: hipAdvice(hLevel, hipDiff),
  });

  // 3. 頭の傾き
  const shoulderCenterX = (lm[LEFT_SHOULDER].x + lm[RIGHT_SHOULDER].x) / 2;
  const headTilt = lm[NOSE].x - shoulderCenterX;
  const headLevel = getLevel(headTilt, THRESHOLDS.head);
  results.push({
    label: "頭の傾き",
    value: diffToDegree(headTilt),
    unit: "°",
    level: headLevel,
    message: tiltToMessage(headTilt, THRESHOLDS.head, "頭"),
    advice: headAdvice(headLevel, headTilt),
  });

  // 4. 膝の高さの差
  const kneeDiff = lm[LEFT_KNEE].y - lm[RIGHT_KNEE].y;
  const kLevel = getLevel(kneeDiff, THRESHOLDS.knee);
  results.push({
    label: "膝の高さの差",
    value: diffToDegree(kneeDiff),
    unit: "°",
    level: kLevel,
    message: diffToMessage(kneeDiff, THRESHOLDS.knee, "左膝", "右膝"),
    advice: kneeAdvice(kLevel),
  });

  // 5. 重心バランス
  const hipCenterX = (lm[LEFT_HIP].x + lm[RIGHT_HIP].x) / 2;
  const balanceDiff = shoulderCenterX - hipCenterX;
  const bLevel = getLevel(balanceDiff, THRESHOLDS.balance);
  results.push({
    label: "重心バランス",
    value: diffToDegree(balanceDiff),
    unit: "°",
    level: bLevel,
    message: tiltToMessage(balanceDiff, THRESHOLDS.balance, "重心"),
    advice: balanceAdvice(bLevel, balanceDiff),
  });

  // 6. 前傾姿勢（猫背）検出 — Z座標活用
  const noseZ = lm[NOSE].z || 0;
  const shoulderCenterZ = ((lm[LEFT_SHOULDER].z || 0) + (lm[RIGHT_SHOULDER].z || 0)) / 2;
  const forwardLean = noseZ - shoulderCenterZ;
  const fLevel = getLevel(forwardLean, THRESHOLDS.forward);
  results.push({
    label: "前傾姿勢（猫背）",
    value: Math.round(Math.abs(forwardLean) * 100) / 10,
    unit: "cm",
    level: fLevel,
    message: fLevel === "good" ? "前後バランス良好です" : "前傾（猫背）傾向があります",
    advice: forwardAdvice(fLevel),
  });

  return results;
}

// ===== 描画関数 =====
export function drawDiagnosisOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number
): void {
  if (landmarks.length < 33) return;

  const lm = getAveragedLandmarks() || landmarks;

  const toPixel = (l: Landmark) => ({
    x: l.x * canvasWidth,
    y: l.y * canvasHeight,
  });

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

  const shoulderCenter = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
  };
  const hipCenter = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
  };

  // 中心線（点線）
  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.moveTo(shoulderCenter.x, nose.y - 30);
  ctx.lineTo(shoulderCenter.x, (lAnkle.y + rAnkle.y) / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // 重心ライン
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

function drawHorizontalLine(
  ctx: CanvasRenderingContext2D,
  left: { x: number; y: number },
  right: { x: number; y: number },
  diff: number,
  threshold: { good: number; caution: number },
  label: string
): void {
  const level = getLevel(diff, threshold);
  const color = levelColor(level);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left.x, left.y);
  ctx.lineTo(right.x, right.y);
  ctx.stroke();

  const avgY = (left.y + right.y) / 2;
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left.x - 20, avgY);
  ctx.lineTo(right.x + 20, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  if (level !== "good") {
    ctx.fillStyle = color;
    ctx.fillText(label, right.x + 10, right.y);
  }
}

function levelColor(level: "good" | "caution" | "bad"): string {
  switch (level) {
    case "good": return "#22c55e";
    case "caution": return "#eab308";
    case "bad": return "#ef4444";
  }
}
