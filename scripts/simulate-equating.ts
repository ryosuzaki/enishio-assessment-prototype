/**
 * 共通尺度化エンジンの合成データ検証を実行し、docs/equating-simulation/ へ書き出す。
 * 仕様: specs/004-equating-simulation/spec.md
 *
 *   npm run sim:equating
 *
 * LLM API・DB は使わない。乱数種を固定しているので、誰が実行しても同じ結果になる。
 */
import fs from "node:fs";
import path from "node:path";
import {
  DEFAULT_EXPERIMENT1,
  DEFAULT_EXPERIMENT2,
  runExperiment1,
  runExperiment2,
  type Experiment2Scenario,
  type Summary,
} from "../src/lib/equating/simulation";

const SEED = 20260924;
const REPS_EXP1 = 200;
const REPS_EXP2 = 500;
const LAMBDAS = [0, 0.25, 0.5, 0.75, 1];
const KS = [5, 10, 20];

const outDir = path.resolve(process.cwd(), "docs/equating-simulation");
fs.mkdirSync(outDir, { recursive: true });

const f2 = (x: number) => x.toFixed(2);
const fmt = (s: Summary) => `${f2(s.mean)}（${f2(s.p05)}〜${f2(s.p95)}）`;

// ---------------------------------------------------------------------------
// 実験1
// ---------------------------------------------------------------------------

type Exp1Row = { k: number; lambda: number; absolute: Summary; pairwise: Summary };
const exp1: Exp1Row[] = [];
for (const k of KS) {
  for (const lambda of LAMBDAS) {
    const r = runExperiment1(
      { ...DEFAULT_EXPERIMENT1, comparisonsPerLearner: k, lambda },
      REPS_EXP1,
      SEED + k * 100 + Math.round(lambda * 100),
    );
    exp1.push({ k, lambda, ...r });
  }
}
// 絶対採点は k にも λ にも依存しないので、全条件をまとめた平均を基準線にする
const absoluteMean =
  exp1.reduce((s, r) => s + r.absolute.mean, 0) / exp1.length;
const absoluteBand = exp1.find((r) => r.k === 10 && r.lambda === 0)!.absolute;

// ---------------------------------------------------------------------------
// 実験2
// ---------------------------------------------------------------------------

const SCENARIOS: { id: Experiment2Scenario; label: string }[] = [
  { id: "ability_gain", label: "(a) 実力が上がった（判定器は同じ）" },
  { id: "judge_drift", label: "(b) 判定器の版が変わってズレた（実力は同じ）" },
  { id: "both", label: "(c) 両方が同時に起きた" },
];
const exp2 = SCENARIOS.map((s, i) => ({
  ...s,
  result: runExperiment2(s.id, DEFAULT_EXPERIMENT2, REPS_EXP2, SEED + 1000 + i),
}));

// ---------------------------------------------------------------------------
// 図1（SVG）。GitHub では <img> として表示されるので、ホバーは付けず、
// 値は下の表で読めるようにする。色は OS のダークモードに追従させる。
// ---------------------------------------------------------------------------

function figure1(): string {
  const W = 720;
  const H = 420;
  const m = { top: 24, right: 150, bottom: 64, left: 64 };
  const pw = W - m.left - m.right;
  const ph = H - m.top - m.bottom;
  const yMin = 0.4;
  const yMax = 1.0;
  const x = (l: number) => m.left + l * pw;
  const y = (v: number) => m.top + ((yMax - v) / (yMax - yMin)) * ph;

  const series = KS.map((k, i) => ({
    k,
    cls: `s${i + 1}`,
    points: exp1.filter((r) => r.k === k).map((r) => ({ l: r.lambda, v: r.pairwise.mean })),
  }));

  const grid = [0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    .map(
      (v) =>
        `<line class="grid" x1="${m.left}" x2="${m.left + pw}" y1="${y(v)}" y2="${y(v)}"/>` +
        `<text class="tick" x="${m.left - 8}" y="${y(v) + 4}" text-anchor="end">${v.toFixed(1)}</text>`,
    )
    .join("");
  const xticks = LAMBDAS.map(
    (l) => `<text class="tick" x="${x(l)}" y="${m.top + ph + 18}" text-anchor="middle">${l}</text>`,
  ).join("");

  // 絶対採点の 5〜95% 帯と平均線（比較の基準なので灰色で退かせる）
  // 帯は描画範囲（yMin〜yMax）で切る。はみ出すと横軸の目盛りに重なる
  const bandTop = y(Math.min(yMax, absoluteBand.p95));
  const bandBottom = y(Math.max(yMin, absoluteBand.p05));
  const band =
    `<rect class="band" x="${m.left}" width="${pw}" y="${bandTop}" height="${bandBottom - bandTop}"/>` +
    `<line class="abs" x1="${m.left}" x2="${m.left + pw}" y1="${y(absoluteMean)}" y2="${y(absoluteMean)}"/>` +
    `<text class="label muted" x="${m.left + pw + 8}" y="${y(absoluteMean) + 4}">絶対採点</text>` +
    `<text class="tick" x="${m.left + pw + 8}" y="${y(absoluteMean) + 20}">（帯は5〜95%）</text>`;

  const lines = series
    .map((s) => {
      const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.l)},${y(p.v)}`).join("");
      const dots = s.points
        .map((p) => `<circle class="${s.cls} dot" cx="${x(p.l)}" cy="${y(p.v)}" r="4"/>`)
        .join("");
      return `<path class="${s.cls} line" d="${d}"/>${dots}`;
    })
    .join("");

  // 系列名は左端（λ=0）の値の横に置くと線と重なるので、右余白に縦に並べた凡例にする
  const legend = series
    .map(
      (s, i) =>
        `<line class="${s.cls} line" x1="${m.left + pw + 8}" x2="${m.left + pw + 30}" y1="${m.top + 10 + i * 22}" y2="${m.top + 10 + i * 22}"/>` +
        `<text class="label" x="${m.left + pw + 36}" y="${m.top + 14 + i * 22}">一対比較 k=${s.k}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">判定器に残る難易度の影響と、真の実力との順位相関</title>
<desc id="d">横軸は判定器に残る課題難易度の影響λ、縦軸は真の実力との順位相関。一対比較＋Bradley-Terryは比較回数k=5,10,20の3本、絶対採点は灰色の水平線と帯。</desc>
<style>
  svg { font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Noto Sans JP", sans-serif; }
  .bg { fill: #fcfcfb; }
  .grid { stroke: #e1e0d9; stroke-width: 1; }
  .axis { stroke: #c3c2b7; stroke-width: 1; }
  .tick { fill: #898781; font-size: 12px; }
  .title { fill: #52514e; font-size: 13px; }
  .label { fill: #0b0b0b; font-size: 12px; }
  .muted { fill: #52514e; }
  .band { fill: #898781; opacity: 0.14; }
  .abs { stroke: #898781; stroke-width: 2; stroke-dasharray: 6 4; }
  .line { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .dot { stroke: #fcfcfb; stroke-width: 2; }
  .s1.line { stroke: #86b6ef; } .s1.dot { fill: #86b6ef; }
  .s2.line { stroke: #2a78d6; } .s2.dot { fill: #2a78d6; }
  .s3.line { stroke: #104281; } .s3.dot { fill: #104281; }
  @media (prefers-color-scheme: dark) {
    .bg { fill: #1a1a19; }
    .grid { stroke: #2c2c2a; }
    .axis { stroke: #383835; }
    .title { fill: #c3c2b7; }
    .label { fill: #ffffff; }
    .muted { fill: #c3c2b7; }
    .dot { stroke: #1a1a19; }
    .s1.line { stroke: #256abf; } .s1.dot { fill: #256abf; }
    .s2.line { stroke: #5598e7; } .s2.dot { fill: #5598e7; }
    .s3.line { stroke: #9ec5f4; } .s3.dot { fill: #9ec5f4; }
  }
</style>
<rect class="bg" width="${W}" height="${H}" rx="8"/>
${grid}
${band}
<line class="axis" x1="${m.left}" x2="${m.left + pw}" y1="${m.top + ph}" y2="${m.top + ph}"/>
${xticks}
${lines}
${legend}
<text class="title" x="${m.left + pw / 2}" y="${H - 18}" text-anchor="middle">判定器に残る課題難易度の影響 λ（0＝取り除ける、1＝絶対採点と同じだけ残る）</text>
<text class="title" transform="translate(18 ${m.top + ph / 2}) rotate(-90)" text-anchor="middle">真の実力との順位相関</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

const exp1Table = [
  "| λ | 絶対採点 | 一対比較 k=5 | 一対比較 k=10 | 一対比較 k=20 |",
  "| :-- | :-- | :-- | :-- | :-- |",
  ...LAMBDAS.map((l) => {
    const row = (k: number) => exp1.find((r) => r.k === k && r.lambda === l)!;
    return `| ${l} | ${fmt(row(10).absolute)} | ${fmt(row(5).pairwise)} | ${fmt(row(10).pairwise)} | ${fmt(row(20).pairwise)} |`;
  }),
].join("\n");

const exp2Table = [
  "| シナリオ | 第1層が示す伸び | 固定設問が示す伸び | 食い違い（第1層 − 固定設問） | 凍結ペアの一致率の変化 | 対照ペアで表層特徴の強い側を選んだ率 |",
  "| :-- | :-- | :-- | :-- | :-- | :-- |",
  ...exp2.map(
    ({ label, result: r }) =>
      `| ${label} | ${fmt(r.layer1Gain)} | ${fmt(r.anchorGain)} | ${fmt(r.gainDiscrepancy)} | ${fmt(r.agreementChange)} | ${fmt(r.controlStylePreference)} |`,
  ),
].join("\n");

const P1 = DEFAULT_EXPERIMENT1;
const P2 = DEFAULT_EXPERIMENT2;

const md = `# 共通尺度化エンジンの合成データ検証

> このファイルは \`npm run sim:equating\`（[scripts/simulate-equating.ts](../../scripts/simulate-equating.ts)）が生成しています。手で編集しないでください。
> 仕様: [specs/004-equating-simulation/spec.md](../../specs/004-equating-simulation/spec.md)／実装: [src/lib/equating/](../../src/lib/equating/)

提案の中核である共通尺度化エンジン（第1層：証拠の一対比較＋Bradley-Terry、第2層：固定設問と凍結ペア判定による定点較正）が、**統計的な仕組みとして筋が通っているか**を、合成データで確かめたものです。LLM API は呼んでいません。

**この検証が示さないこと**：LLM 判定器が実際に下の仮定を満たすかどうかは示しません。特に実験1の λ（一対比較の判定器が課題難易度の影響をどこまで取り除けるか）は、事業期間中に人間専門家の判定との一致率で実測する対象です。ここでの数値を、到達目標の達成見込みとしては使いません。

数値はいずれも反復の平均で、括弧内は 5〜95% の範囲です。

---

## 実験1：受講者ごとに課題の難易度が違うとき、どちらが実力を回復できるか

受講者 ${P1.learners} 名が、それぞれ自分だけの課題（難易度はばらばら、共有なし）を解いた状況をつくり、次の2つで並べて真の実力との順位相関を比べました（各条件 ${REPS_EXP1} 回反復）。

- **絶対採点**：自分の課題の出来を 0〜5 のバンドで採点する。課題が易しければ高く、難しければ低く出る。
- **一対比較＋Bradley-Terry**：他の受講者の証拠と見比べて勝敗を判定し、勝敗の網から能力値を推定する。1人あたり k 回比較する。

![判定器に残る難易度の影響と、真の実力との順位相関](figure-1.svg)

${exp1Table}

**読み取れること**

- 判定器が課題難易度の影響を取り除けるほど（λ が小さいほど）、一対比較＋Bradley-Terry は絶対採点より実力をよく回復する。1人10回の比較で、λ=0 なら ${f2(exp1.find((r) => r.k === 10 && r.lambda === 0)!.pairwise.mean)}、絶対採点は ${f2(absoluteMean)}。
- λ=1（判定器が難易度の影響を絶対採点と同じだけ受ける）では、比較を増やしても差はほとんど残らない。**一対比較にするだけで難易度の問題が解けるわけではなく、成否は λ にかかっている。**
- したがって事業期間中に実測すべきは、判定器が難易度の違う課題の証拠をどこまで公平に見比べられるか（λ に当たる量）である。提案書の到達目標「一対比較の勝敗判定が実務専門家の優劣判断と75%以上合致するか」は、この量を人間基準で測るものに当たる。

---

## 実験2：「受講者が伸びた」のか「判定器がズレた」のかを切り分けられるか

基準期のコホートAと次期のコホートB（各 ${P2.learnersPerCohort} 名）を置き、3つのシナリオを比べました（各 ${REPS_EXP2} 回反復）。コホートBは、実力とは関係なく文章量などの表層特徴が強い（新しいAIツールで書くと長くなる、といった状況）と仮定しています。判定器の「ズレ」は、版が変わった判定器がこの表層特徴にも重みを置き始めることで表します。

- **第1層**：コホートA内の比較は基準期の判定器で済んでおり、コホートB内とA–B間の比較はいまの判定器で行う。A・Bを結合して Bradley-Terry で推定し、Bの平均がAよりどれだけ高いかを見る。
- **第2層(1) 固定設問**：LLM を通さずに採点する。Bの平均がAよりどれだけ高いかを見る。
- **第2層(2) 凍結ペア**：コホートAから無作為に選んだ ${P2.frozenPairs} 組を人間専門家が判定して保存しておき、いまの判定器で再判定して一致率の変化を見る。
- **対照ペア（凍結ペアの工夫）**：同じ証拠の原文と、中身を変えずに表層特徴だけを強めた版の組を ${P2.controlPairs} 組混ぜる。健全な判定器なら、表層特徴の強い側を選ぶ率は 50% 前後になる。

「伸び」はコホートAの標準偏差を単位にしています（真の伸びは (a)(c) で ${P2.abilityGain}、(b) で 0）。

${exp2Table}

**読み取れること**

- (a) では第1層と固定設問の伸びが揃い、食い違いは 0 前後。(b) では第1層だけが伸びを示し、固定設問は動かない。**2つの食い違いが「判定器がズレた」ことの信号になる**（提案書 ②4 の「固定設問の得点が変わっていないのに第1層のスコアだけが動いていれば、判定器がズレたと見抜ける」に当たる）。(c) では固定設問が本当の伸びを示し、食い違いがズレの分を示す。
- 一方、**凍結ペアを無作為に ${P2.frozenPairs} 組選ぶだけでは、この大きさのズレはほとんど検出できない**（一致率の変化の範囲が 0 をまたぐ）。表層特徴の違いが勝敗を左右するペアが少ないためである。
- 中身が同じで表層特徴だけが違う**対照ペアを ${P2.controlPairs} 組混ぜると、ズレははっきり検出できる**。凍結ペアは無作為抽出だけでなく、想定されるバイアス（文章量、流暢さ、提示順など）ごとの対照ペアを含めて設計する必要がある。これは事業期間中の凍結データ設計に反映する。

---

## 仮定したパラメータ

| 項目 | 値 |
| :-- | :-- |
| 乱数種 | ${SEED} |
| 実験1：受講者数 | ${P1.learners} |
| 実験1：絶対採点の測定ノイズ（実力の標準偏差単位） | ${P1.absoluteNoise} |
| 一対比較の判定の鋭さ（ロジスティックの傾き） | ${P1.discrimination} |
| 実験2：コホートあたりの受講者数 | ${P2.learnersPerCohort} |
| 実験2：コホート内の比較回数（1人あたり） | ${P2.comparisonsPerLearner} |
| 実験2：A–B間の比較回数（Bの1人あたり） | ${P2.crossComparisonsPerLearner} |
| 実験2：コホートBの表層特徴の平均（標準偏差単位） | ${P2.styleShift} |
| 実験2：ズレた判定器が表層特徴に置く重み | ${P2.driftWeight} |
| 実験2：固定設問の測定ノイズ | ${P2.anchorNoise} |
| 実験2：凍結ペア数／対照ペア数 | ${P2.frozenPairs}／${P2.controlPairs} |
| 実験2：対照ペアで強めた表層特徴の差 | ${P2.controlStyleGap} |

Bradley-Terry の推定は MM アルゴリズム（Hunter 2004）で、全勝・全敗の受講者でも発散しないよう、各受講者に仮想相手との1勝1敗を足して弱く正則化しています。
`;

fs.writeFileSync(path.join(outDir, "figure-1.svg"), figure1());
fs.writeFileSync(path.join(outDir, "README.md"), md);
console.log(`wrote ${path.relative(process.cwd(), outDir)}/README.md and figure-1.svg`);
