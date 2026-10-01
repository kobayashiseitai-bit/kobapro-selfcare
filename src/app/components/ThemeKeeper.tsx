"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 表示テーマと文字サイズの付け直し（保険）
 *
 * layout.tsx の起動時スクリプトは、html に theme-mint（明るい表示）と文字サイズを付ける。
 * ところが、どこかの画面でサーバーとスマホの表示が食い違う（ハイドレーションの失敗）と、
 * React が html を作り直し、この2つが消えて「黒い表示・標準の文字サイズ」に戻ってしまう。
 * 2026-10-01 に設定画面で実際に起きた（画面を組み立てる時点で端末IDを表示していた）。
 * 原因の行は消したが、同じことが別の画面で起きても元に戻るよう、画面を開くたびに保存済みの設定を付け直す。
 *
 * 判定は layout.tsx の起動時スクリプトと同じにすること。LP は独自デザインなので、theme-mint と文字サイズを外して
 * 初めて読み込んだときと同じ状態に戻す（他の画面から画面切り替えで戻ってきたときに残さないため）。
 * 何も描画しない。
 */
export default function ThemeKeeper() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      const root = document.documentElement;
      if (pathname?.startsWith("/lp")) {
        // LP では起動時スクリプトが何も付けない。別の画面（/privacy など）で付けた
        // theme-mint と文字サイズが、画面切り替えで LP に戻ったときに残らないよう外す。
        root.classList.remove("theme-mint");
        if (root.style.fontSize) root.style.fontSize = "";
        return;
      }

      const saved = localStorage.getItem("zero_pain_theme") || "light";
      const resolved =
        saved === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : saved;
      if (resolved === "light") {
        root.classList.add("theme-mint");
      } else {
        root.classList.remove("theme-mint");
      }

      const textSize = localStorage.getItem("zero_pain_text_size") || "medium";
      const rootSize =
        textSize === "small" ? "14px" :
        textSize === "large" ? "18px" :
        textSize === "xlarge" ? "20px" :
        "16px";
      if (root.style.fontSize !== rootSize) root.style.fontSize = rootSize;
    } catch {
      /* localStorage が使えない環境では、起動時スクリプトの結果のまま */
    }
  }, [pathname]);

  return null;
}
