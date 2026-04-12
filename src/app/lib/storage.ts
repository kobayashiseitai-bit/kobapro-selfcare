// ランドマーク座標
export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
}

// 診断結果
export interface DiagnosisItem {
  label: string;
  value: number;
  unit: string;
  level: "good" | "caution" | "bad";
  message: string;
  advice: string;
}

// 撮影記録
export interface PostureRecord {
  id: string;
  customerId: string;
  date: string;
  landmarks: Landmark[];
  diagnosis: DiagnosisItem[];
  imageDataUrl: string;
}

// --- 撮影記録管理（localStorage） ---

const RECORDS_KEY = "kobapro_records";

function getAllRecords(): PostureRecord[] {
  if (typeof window === "undefined") return [];
  const data = localStorage.getItem(RECORDS_KEY);
  return data ? JSON.parse(data) : [];
}

export function getRecords(customerId: string): PostureRecord[] {
  return getAllRecords()
    .filter((r) => r.customerId === customerId)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function addRecord(
  customerId: string,
  landmarks: Landmark[],
  diagnosis: DiagnosisItem[],
  imageDataUrl: string
): PostureRecord {
  const records = getAllRecords();
  const record: PostureRecord = {
    id: crypto.randomUUID(),
    customerId,
    date: new Date().toISOString(),
    landmarks,
    diagnosis,
    imageDataUrl,
  };
  records.push(record);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  return record;
}

export function deleteRecord(id: string): void {
  const records = getAllRecords().filter((r) => r.id !== id);
  localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}
