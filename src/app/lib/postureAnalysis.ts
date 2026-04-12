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

const THRESHOLD_GOOD = 0.015;
const THRESHOLD_CAUTION = 0.035;

function getLevel(diff: number): "good" | "caution" | "bad" {
  const abs = Math.abs(diff);
  if (abs <= THRESHOLD_GOOD) return "good";
  if (abs <= THRESHOLD_CAUTION) return "caution";
  return "bad";
}

function diffToMessage(diff: number, leftLabel: string, rightLabel: string): string {
  if (Math.abs(diff) <= THRESHOLD_GOOD) return "左右バランス良好です";
  const direction = diff > 0 ? rightLabel : leftLabel;
  return `${direction}が下がっています`;
}

function tiltToMessage(diff: number, label: string): string {
  if (Math.abs(diff) <= THRESHOLD_GOOD) return `${label}は正常です`;
  const direction = diff > 0 ? "右" : "左";
  return `${label}が${direction}に傾いています`;
}

function diffToDegree(diff: number): number {
  return Math.round(Math.abs(diff) * 180 * 10) / 10;
}

// アドバイス生成
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

export function analyzePosture(landmarks: Landmark[]): DiagnosisItem[] {
  if (landmarks.length < 33) return [];

  const results: DiagnosisItem[] = [];

  const shoulderDiff = landmarks[LEFT_SHOULDER].y - landmarks[RIGHT_SHOULDER].y;
  const sLevel = getLevel(shoulderDiff);
  results.push({
    label: "肩の傾き",
    value: diffToDegree(shoulderDiff),
    unit: "°",
    level: sLevel,
    message: diffToMessage(shoulderDiff, "左肩", "右肩"),
    advice: shoulderAdvice(sLevel, shoulderDiff),
  });

  const hipDiff = landmarks[LEFT_HIP].y - landmarks[RIGHT_HIP].y;
  const hLevel = getLevel(hipDiff);
  results.push({
    label: "骨盤の傾き",
    value: diffToDegree(hipDiff),
    unit: "°",
    level: hLevel,
    message: diffToMessage(hipDiff, "左腰", "右腰"),
    advice: hipAdvice(hLevel, hipDiff),
  });

  const shoulderCenterX = (landmarks[LEFT_SHOULDER].x + landmarks[RIGHT_SHOULDER].x) / 2;
  const headTilt = landmarks[NOSE].x - shoulderCenterX;
  const headLevel = getLevel(headTilt);
  results.push({
    label: "頭の傾き",
    value: diffToDegree(headTilt),
    unit: "°",
    level: headLevel,
    message: tiltToMessage(headTilt, "頭"),
    advice: headAdvice(headLevel, headTilt),
  });

  const kneeDiff = landmarks[LEFT_KNEE].y - landmarks[RIGHT_KNEE].y;
  const kLevel = getLevel(kneeDiff);
  results.push({
    label: "膝の高さの差",
    value: diffToDegree(kneeDiff),
    unit: "°",
    level: kLevel,
    message: diffToMessage(kneeDiff, "左膝", "右膝"),
    advice: kneeAdvice(kLevel),
  });

  const hipCenterX = (landmarks[LEFT_HIP].x + landmarks[RIGHT_HIP].x) / 2;
  const balanceDiff = shoulderCenterX - hipCenterX;
  const bLevel = getLevel(balanceDiff);
  results.push({
    label: "重心バランス",
    value: diffToDegree(balanceDiff),
    unit: "°",
    level: bLevel,
    message: tiltToMessage(balanceDiff, "重心"),
    advice: balanceAdvice(bLevel, balanceDiff),
  });

  return results;
}

export function drawDiagnosisOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number
): void {
  if (landmarks.length < 33) return;

  const toPixel = (lm: Landmark) => ({
    x: lm.x * canvasWidth,
    y: lm.y * canvasHeight,
  });

  const lShoulder = toPixel(landmarks[LEFT_SHOULDER]);
  const rShoulder = toPixel(landmarks[RIGHT_SHOULDER]);
  const lHip = toPixel(landmarks[LEFT_HIP]);
  const rHip = toPixel(landmarks[RIGHT_HIP]);
  const nose = toPixel(landmarks[NOSE]);
  const lKnee = toPixel(landmarks[LEFT_KNEE]);
  const rKnee = toPixel(landmarks[RIGHT_KNEE]);
  const lAnkle = toPixel(landmarks[LEFT_ANKLE]);
  const rAnkle = toPixel(landmarks[RIGHT_ANKLE]);

  ctx.lineWidth = 3;
  ctx.font = "bold 14px sans-serif";

  const shoulderDiff = Math.abs(landmarks[LEFT_SHOULDER].y - landmarks[RIGHT_SHOULDER].y);
  drawHorizontalLine(ctx, lShoulder, rShoulder, shoulderDiff, "肩");

  const hipDiff = Math.abs(landmarks[LEFT_HIP].y - landmarks[RIGHT_HIP].y);
  drawHorizontalLine(ctx, lHip, rHip, hipDiff, "骨盤");

  const shoulderCenter = {
    x: (lShoulder.x + rShoulder.x) / 2,
    y: (lShoulder.y + rShoulder.y) / 2,
  };
  const hipCenter = {
    x: (lHip.x + rHip.x) / 2,
    y: (lHip.y + rHip.y) / 2,
  };

  ctx.setLineDash([8, 6]);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.beginPath();
  ctx.moveTo(shoulderCenter.x, nose.y - 30);
  ctx.lineTo(shoulderCenter.x, (lAnkle.y + rAnkle.y) / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  const balanceDiff = Math.abs(shoulderCenter.x - hipCenter.x);
  const balanceLevel = getLevel(balanceDiff / canvasWidth);
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
  label: string
): void {
  const level = getLevel(diff);
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
