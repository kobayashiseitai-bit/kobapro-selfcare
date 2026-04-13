import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);

// デバイスIDを生成・取得（ブラウザごとに固有）
export function getDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem("zero_pain_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("zero_pain_device_id", id);
  }
  return id;
}

// ユーザーを取得または作成
export async function getOrCreateUser(): Promise<string> {
  const deviceId = getDeviceId();
  if (!deviceId) return "";

  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("device_id", deviceId)
    .single();

  if (data) return data.id;

  const { data: newUser } = await supabase
    .from("users")
    .insert({ device_id: deviceId })
    .select("id")
    .single();

  return newUser?.id || "";
}

// 姿勢データを保存
export async function savePostureRecord(
  userId: string,
  landmarks: unknown[],
  diagnosis: unknown[],
  imageDataUrl: string
) {
  return supabase.from("posture_records").insert({
    user_id: userId,
    landmarks,
    diagnosis,
    image_url: imageDataUrl,
  });
}

// チャットログを保存
export async function saveChatLog(
  userId: string,
  role: string,
  content: string,
  recommendedSymptom?: string
) {
  return supabase.from("chat_logs").insert({
    user_id: userId,
    role,
    content,
    recommended_symptom: recommendedSymptom || null,
  });
}

// 症状選択を保存
export async function saveSymptomSelection(userId: string, symptomId: string) {
  return supabase.from("symptom_selections").insert({
    user_id: userId,
    symptom_id: symptomId,
  });
}

// ユーザーの過去のチャット履歴を取得（AI精度向上用）
export async function getUserChatHistory(userId: string, limit = 20) {
  const { data } = await supabase
    .from("chat_logs")
    .select("role, content, recommended_symptom, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// ユーザーの過去の姿勢データを取得
export async function getUserPostureHistory(userId: string, limit = 10) {
  const { data } = await supabase
    .from("posture_records")
    .select("diagnosis, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return data || [];
}

// ユーザーの症状傾向を取得
export async function getUserSymptomTrends(userId: string) {
  const { data } = await supabase
    .from("symptom_selections")
    .select("symptom_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return data || [];
}
