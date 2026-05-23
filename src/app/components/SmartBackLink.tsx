"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * URL の ?from=lp クエリで戻り先を切り替えるリンクコンポーネント
 *
 * - LP 経由 (?from=lp): "/lp" に戻る → 表示は「← LP に戻る」
 * - それ以外 (アプリ内 WebView 等): "/" に戻る → 表示は「← 戻る」(or 指定したテキスト)
 *
 * SSR では fromLp=false で描画され、クライアントマウント後に更新されるため、
 * 一瞬「アプリに戻る」表示が出る可能性はあるが UX 上問題ない。
 */
interface Props {
  className?: string;
  /** デフォルトの戻り先テキスト (アプリ側からの動線) */
  defaultLabel?: string;
  /** LP からの動線時のテキスト */
  lpLabel?: string;
}

export default function SmartBackLink({
  className = "",
  defaultLabel = "← 戻る",
  lpLabel = "← LP に戻る",
}: Props) {
  const [fromLp, setFromLp] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("from") === "lp") setFromLp(true);
  }, []);

  return (
    <Link href={fromLp ? "/lp" : "/"} className={className}>
      {fromLp ? lpLabel : defaultLabel}
    </Link>
  );
}
