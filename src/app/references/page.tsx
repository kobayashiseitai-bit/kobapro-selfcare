/**
 * 参考文献・情報源ページ
 *
 * App Store Review Guideline 1.4.1 (Safety - Physical Harm) 対応:
 * 医療・健康情報を提供するアプリには、ユーザに正確な情報を提供するための
 * citation（情報源）が必要。
 *
 * 姿勢ケア・ストレッチ・栄養に関する推奨情報の参考文献を一覧する。
 */

import Link from "next/link";

export const metadata = {
  title: "参考文献・情報源 | ZERO-PAIN",
};

interface RefItem {
  label: string;
  org: string;
  url: string;
  note?: string;
}

const POSTURE_REFS: RefItem[] = [
  {
    label: "姿勢と健康に関する基本情報",
    org: "公益社団法人 日本整形外科学会",
    url: "https://www.joa.or.jp/",
    note: "姿勢・骨格に関する基礎的な医学的知見",
  },
  {
    label: "理学療法・運動療法ガイドライン",
    org: "公益社団法人 日本理学療法士協会",
    url: "https://www.japanpt.or.jp/",
    note: "ストレッチ・運動療法の効果に関する研究情報",
  },
  {
    label: "厚生労働省 ロコモティブシンドローム予防",
    org: "厚生労働省",
    url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/locomo/index.html",
    note: "運動器の健康維持に関する公的情報",
  },
  {
    label: "WHO 身体活動・座位行動ガイドライン",
    org: "世界保健機関 (WHO)",
    url: "https://www.who.int/publications/i/item/9789240015128",
    note: "国際的な身体活動推奨基準",
  },
];

const NUTRITION_REFS: RefItem[] = [
  {
    label: "食事バランスガイド",
    org: "厚生労働省・農林水産省",
    url: "https://www.mhlw.go.jp/bunya/kenkou/eiyou-syokuji.html",
    note: "1日に何をどれだけ食べたらよいかの目安",
  },
  {
    label: "日本人の食事摂取基準（2025年版）",
    org: "厚生労働省",
    url: "https://www.mhlw.go.jp/stf/newpage_44138.html",
    note: "エネルギー・栄養素の摂取量基準",
  },
  {
    label: "健康日本21（第三次）",
    org: "厚生労働省",
    url: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/kenkounippon21.html",
    note: "国民の健康増進に関する基本方針",
  },
];

const SELFCARE_REFS: RefItem[] = [
  {
    label: "セルフケア・健康管理に関する一般情報",
    org: "公益財団法人 健康・体力づくり事業財団",
    url: "https://www.health-net.or.jp/",
    note: "ストレッチ・体操の効果と方法",
  },
  {
    label: "腰痛診療ガイドライン 2019",
    org: "日本整形外科学会・日本腰痛学会",
    url: "https://www.joa.or.jp/",
    note: "腰痛のセルフケアに関する診療指針",
  },
  {
    label: "肩こりの基本情報",
    org: "公益社団法人 日本整形外科学会",
    url: "https://www.joa.or.jp/public/sick/condition/stiff_shoulder.html",
    note: "肩こりの原因とセルフケア",
  },
];

function RefList({ title, items }: { title: string; items: RefItem[] }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-emerald-300">{title}</h2>
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.url} className="card-base p-4 space-y-1">
            <a
              href={it.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold text-emerald-400 underline"
            >
              {it.label}
            </a>
            <p className="text-xs text-gray-300">{it.org}</p>
            {it.note && <p className="text-[11px] text-gray-400">{it.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function ReferencesPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-5 space-y-8">
      <header className="max-w-2xl mx-auto space-y-2">
        <Link
          href="/"
          className="inline-block text-sm text-emerald-400 underline"
        >
          ← トップへ戻る
        </Link>
        <h1 className="text-2xl font-extrabold">参考文献・情報源</h1>
        <p className="text-sm text-gray-300 leading-relaxed">
          本アプリで提供する姿勢分析・セルフケア・栄養に関する情報は、
          以下の公的機関・学会・専門団体の公表情報を参考にしています。
          本アプリの提供情報は<span className="font-bold text-white">セルフケアの参考情報</span>
          であり、医療診断・治療を目的としたものではありません。
          症状が続く場合は医療機関を受診してください。
        </p>
      </header>

      <div className="max-w-2xl mx-auto space-y-8">
        <RefList title="姿勢・運動器" items={POSTURE_REFS} />
        <RefList title="栄養・食事" items={NUTRITION_REFS} />
        <RefList title="セルフケア全般" items={SELFCARE_REFS} />

        <section className="card-accent-amber p-4 space-y-2">
          <p className="text-sm font-bold text-amber-300">
            ⚠️ AI による分析・アドバイスについて
          </p>
          <p className="text-xs text-gray-200 leading-relaxed">
            本アプリは Anthropic 社の Claude AI による分析・アドバイスを提供しますが、
            これらは上記参考文献に基づく一般的なセルフケア情報であり、
            個別の医学的診断・治療を目的とするものではありません。
            重篤な症状（強い痛み・しびれ・急な体調変化など）がある場合は、
            必ず医療機関を受診してください。
          </p>
        </section>

        <section className="card-base p-4 space-y-2">
          <p className="text-xs font-bold text-gray-300">情報の更新について</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            参考文献に挙げた情報源は定期的に更新される可能性があります。
            最新の情報は各機関の公式サイトをご確認ください。
            本ページの内容について不明点・指摘事項がある場合は、
            <Link href="/support" className="text-emerald-400 underline">
              サポートページ
            </Link>
            よりお問い合わせください。
          </p>
        </section>
      </div>
    </main>
  );
}
