/**
 * SNSシェア機能 (iOS/Android/Web 共通)
 *
 * - iOS Safari / Capacitor: Web Share API (ネイティブシート)
 * - 非対応ブラウザ: クリップボードコピーにフォールバック
 */

export interface ShareData {
  title?: string;
  text: string;
  url?: string;
  /** 画像Blobをシェア (iOS/Android Web Share Level 2) */
  imageBlob?: Blob;
  imageFileName?: string;
}

export type ShareResult =
  | { ok: true; method: "native" | "clipboard" }
  | { ok: false; reason: "cancelled" | "unsupported" | "error"; error?: string };

/**
 * 共通シェア関数 (フォールバック付き)
 */
export async function share(data: ShareData): Promise<ShareResult> {
  // 1) ネイティブ Web Share API を試す
  if (typeof navigator !== "undefined" && "share" in navigator) {
    try {
      const payload: { title?: string; text: string; url?: string; files?: File[] } = {
        title: data.title,
        text: data.text,
        url: data.url,
      };

      // 画像付きシェア (Web Share Level 2)
      if (data.imageBlob && "canShare" in navigator) {
        const file = new File(
          [data.imageBlob],
          data.imageFileName || "share.png",
          { type: data.imageBlob.type || "image/png" }
        );
        const candidate = { ...payload, files: [file] };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((navigator as any).canShare(candidate)) {
          payload.files = [file];
        }
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (navigator as any).share(payload);
      return { ok: true, method: "native" };
    } catch (e) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = e as any;
      if (err?.name === "AbortError") {
        return { ok: false, reason: "cancelled" };
      }
      // 他のエラーはフォールバックへ
    }
  }

  // 2) クリップボードコピーにフォールバック
  try {
    const text = [data.title, data.text, data.url].filter(Boolean).join("\n");
    if (typeof navigator !== "undefined" && "clipboard" in navigator) {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard" };
    }
  } catch {
    /* fall through */
  }

  return { ok: false, reason: "unsupported" };
}

/**
 * ストリーク達成のシェア (テキストのみ)
 */
export async function shareStreak(streakDays: number, characterName?: string): Promise<ShareResult> {
  const senseiPrefix = characterName ? `${characterName}と一緒に` : "";
  return share({
    title: "ZERO-PAIN セルフケア継続中！",
    text: `${senseiPrefix}セルフケア${streakDays}日連続達成！🎉\n姿勢チェック × AI先生で体の不調をゼロに。`,
    url: "https://posture-app-steel.vercel.app",
  });
}

/**
 * Before/After 比較画像をシェア
 * @param canvas 比較画像が描画された canvas (or null で url+text のみ)
 */
export async function shareBeforeAfter(canvas: HTMLCanvasElement | null, daysDiff: number): Promise<ShareResult> {
  let imageBlob: Blob | undefined;
  if (canvas) {
    imageBlob = await new Promise<Blob | undefined>((resolve) => {
      canvas.toBlob((b) => resolve(b || undefined), "image/png", 0.9);
    });
  }
  return share({
    title: "ZERO-PAIN Before/After",
    text: `${daysDiff}日間でこんなに姿勢が変わった！\nガイコツ先生のセルフケアでコツコツ続けた成果です💪`,
    url: "https://posture-app-steel.vercel.app",
    imageBlob,
    imageFileName: `zero-pain-before-after-${daysDiff}days.png`,
  });
}

/**
 * 記事をシェア (URL付き)
 */
export async function shareArticle(article: { id: string; title: string; summary: string }): Promise<ShareResult> {
  return share({
    title: article.title,
    text: `${article.title}\n${article.summary}`,
    url: `https://posture-app-steel.vercel.app/articles/${article.id}`,
  });
}

/**
 * シンプルなアプリ紹介シェア (口コミ用)
 */
export async function shareApp(): Promise<ShareResult> {
  return share({
    title: "ZERO-PAIN セルフケアアプリ",
    text: "AIガイコツ先生があなた専属コーチに🦴\n姿勢チェック・食事相談・ストレッチ提案で体の不調をゼロに。",
    url: "https://posture-app-steel.vercel.app",
  });
}
