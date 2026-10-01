/**
 * 固定設問の項目数の合成データ検証を実行し、docs/anchor-length-simulation/ へ書き出す。
 * 仕様: specs/005-anchor-length-simulation/spec.md
 *
 *   npm run sim:anchor-length
 *
 * LLM API・DB は使わない。乱数種を固定しているので、誰が実行しても同じ結果になる。
 */
import fs from "node:fs";
import path from "node:path";
import {
  CRITERION,
  attenuationCeiling,
  calibrateLoading,
  runAnchorLength,
  spearmanBrown,
  type AnchorLengthResult,
} from "../src/lib/anchor-length/simulation";

const SEED = 20261001;
const LEARNERS = 60;
const REPS_MAIN = 1000;
const REPS_SENSITIVITY = 400;
const LENGTHS = [10, 15, 20, 25, 30, 40, 50, 60, 80];
const TRUE_CORRELATIONS = [0.7, 0.8, 0.9, 1.0];
const CJ_MAIN = 0.8;
const CJ_SENSITIVITY = [0.7, 0.9];
const TARGET_PASS_RATE = 0.8;
/** 1項目あたりの所要時間の見込み（分）。実測ではない */
const MINUTES_PER_ITEM = [0.75, 1.0];

const PER_ITEM = [
  { value: 0.03, label: "60〜90項目で α ≈ 0.70 になる水準" },
  { value: 0.06, label: "60〜90項目で α ≈ 0.80 になる水準" },
  { value: 0.1, label: "中間" },
  { value: 0.14, label: "仕様の近似 SE(θ) ≈ 2.5/√L に相当する水準" },
];

const outDir = path.resolve(process.cwd(), "docs/anchor-length-simulation");
fs.mkdirSync(outDir, { recursive: true });

const f2 = (x: number) => x.toFixed(2);
const pct = (x: number) => `${Math.round(x * 100)}%`;
const minutes = (l: number) => `${Math.round(l * MINUTES_PER_ITEM[0])}〜${Math.round(l * MINUTES_PER_ITEM[1])}分`;

// ---------------------------------------------------------------------------
// 実行
// ---------------------------------------------------------------------------

const loadings = PER_ITEM.map((p, k) => calibrateLoading(p.value, SEED + k));

type Key = string;
const key = (p: number, l: number, r: number, cj: number): Key => `${p}|${l}|${r}|${cj}`;
const results = new Map<Key, AnchorLengthResult>();

const run = (cj: number, reps: number) => {
  PER_ITEM.forEach((p, pi) => {
    for (const length of LENGTHS) {
      for (const trueCorrelation of TRUE_CORRELATIONS) {
        const seed = SEED + pi * 100000 + length * 1000 + Math.round(trueCorrelation * 100) + Math.round(cj * 10);
        results.set(
          key(p.value, length, trueCorrelation, cj),
          runAnchorLength({ learners: LEARNERS, length, loading: loadings[pi], trueCorrelation, cjReliability: cj }, reps, seed),
        );
      }
    }
  });
};
run(CJ_MAIN, REPS_MAIN);
for (const cj of CJ_SENSITIVITY) run(cj, REPS_SENSITIVITY);

const minimumLength = (p: number, r: number, cj: number): number | null => {
  for (const length of LENGTHS) {
    if (results.get(key(p, length, r, cj))!.passRate >= TARGET_PASS_RATE) return length;
  }
  return null;
};

// ---------------------------------------------------------------------------
// 書き出し
// ---------------------------------------------------------------------------

const lines: string[] = [];
const w = (s = "") => lines.push(s);

w("# 固定設問の項目数の合成データ検証");
w();
w("> このファイルは `npm run sim:anchor-length`（[scripts/simulate-anchor-length.ts](../../scripts/simulate-anchor-length.ts)）が生成しています。手で編集しないでください。");
w("> 仕様: [specs/005-anchor-length-simulation/spec.md](../../specs/005-anchor-length-simulation/spec.md)／実装: [src/lib/anchor-length/](../../src/lib/anchor-length/)");
w();
w(`第2層の固定設問（共通アンカー）が何項目あれば、収束妥当性の基準（$\\theta_{\\text{CJ}}$ と固定設問の得点の Spearman 順位相関が ${CRITERION.rho} 以上、95%信頼区間の下限が ${CRITERION.lowerBound} を超える。受講者 ${LEARNERS} 名）に届くかを、合成データで調べたものです。LLM API は呼んでいません。`);
w();
w("**この検証が示さないこと**：実際の固定設問の1項目あたりの信頼性と、2つの構成概念の真の相関は示しません。どちらも本検証では値を振っています。前者は PoC 第1弾の応答から推定する量で、後者は収束妥当性の検査が確かめようとしている量そのものです。所要時間は1項目45秒〜1分という見込みからの換算で、実測ではありません。ここでの数値を、到達目標の達成見込みとしては使いません。");
w();
w("---");
w();
w("## 生成モデル");
w();
w(`- **真値**: 受講者 ${LEARNERS} 名に、$(\\theta_{\\text{CJ}}, \\theta_{\\text{A}})$ を相関 $r_{\\text{true}}$ の2変量標準正規分布から割り振ります。`);
w("- **共通尺度の観測値**: $\\hat\\theta_{\\text{CJ}} = \\theta_{\\text{CJ}} + e$。誤差 $e$ の分散は、信頼性が $\\text{rel}_{\\text{CJ}}$ になるように決めます（主条件は 0.80。到達基準の SSR ≥ 0.80 に合わせた値ですが、SSR は成果物単位の信頼性で、受講者単位の値はまだ定義されていません）。");
w("- **固定設問**: 項目 $j$ の潜在反応を $y_{ij} = \\lambda\\theta_{\\text{A},i} + \\sqrt{1-\\lambda^2}\\,\\varepsilon_{ij}$ とし、項目ごとの閾値で 0〜3 点の4段階に切ります。得点は合計点です。項目どうしは $\\theta_{\\text{A}}$ を通してのみ相関します（1状況文1設問）。負荷 $\\lambda$ は、1項目あたりの信頼性（実現値）が下表の目標値になるよう較正しました。");
w(`- **判定**: 各条件 ${REPS_MAIN} 回（感度分析は ${REPS_SENSITIVITY} 回）繰り返し、基準を満たした割合を出します。信頼区間は Fisher z（標準誤差は Bonett & Wright の式）です。`);
w();
w("### 1項目あたりの信頼性の想定");
w();
w("この値が結論を最も大きく左右し、しかも実際の設問を出すまで分かりません。そこで幅をもたせて4つ置きました。");
w();
w("| 1項目あたりの信頼性 | 意味 | 15項目での α | 20項目での α | 負荷 λ |");
w("| :-- | :-- | :-- | :-- | :-- |");
PER_ITEM.forEach((p, pi) => {
  w(`| ${p.value} | ${p.label} | ${f2(spearmanBrown(p.value, 15))} | ${f2(spearmanBrown(p.value, 20))} | ${f2(loadings[pi])} |`);
});
w();
w("---");
w();
w("## 読み取れること");
w();
w("- **必要な項目数は、1項目あたりの信頼性しだいで数倍変わる。**$r_{\\text{true}} = 0.9$・$\\text{rel}_{\\text{CJ}} = 0.8$ のとき、信頼性 0.14 なら 20 項目、0.10 なら 30 項目、0.06 なら 50 項目で届く。0.03 では 80 項目でも届かない。この値は実際の設問を出すまで分からないので、項目数を机上だけで決めることはできない。");
w("- **2つの構成概念の真の相関が 0.8 以下だと、項目数を増やしても基準にほぼ届かない。**$\\text{rel}_{\\text{CJ}} = 0.8$ では、どの信頼性でも 80 項目まで増やして届かなかった。観測相関の上限 $r_{\\text{true}}\\sqrt{\\text{rel}_{\\text{A}}\\cdot\\text{rel}_{\\text{CJ}}}$ が 0.60 を十分に超えないためである。つまり「観測相関 ≥ 0.60」という基準は、固定設問と共通尺度がほぼ同じものを測っていること（$r_{\\text{true}} \\ge 0.9$）を前提にしている。");
w("- **受講者 60 名では、「下限 > 0.40」は「$\\hat\\rho \\ge 0.60$」とほぼ同じ条件になる。**$\\hat\\rho = 0.60$ のときの下限が 0.40 前後になるためである。");
w("- **希薄化補正後の値は、項目数の影響をほとんど受けずに真の相関の近くに来る。**1項目あたりの信頼性が 0.06 以上なら、15〜20 項目でも中央値は真の相関に近い。ただし区間は広い。また、順位相関と4段階の得点を使っているため、真の相関より 0.03 ほど低めに出る。");
w();
w("---");
w();
w("## 結果1：基準を満たす確率が 80% に届く最小の項目数");
w();
w(`格子（${LENGTHS.join("・")} 項目）の中で、基準を満たした割合が ${pct(TARGET_PASS_RATE)} 以上になった最小の項目数です。「—」は ${LENGTHS[LENGTHS.length - 1]} 項目でも届かなかったことを示します。括弧内は所要時間の見込みです。`);
w();
for (const cj of [CJ_MAIN, ...CJ_SENSITIVITY]) {
  w(`### $\\text{rel}_{\\text{CJ}} = ${cj}$${cj === CJ_MAIN ? "（主条件）" : "（感度分析）"}`);
  w();
  w(`| 1項目あたりの信頼性 | ${TRUE_CORRELATIONS.map((r) => `$r_{\\text{true}}=${r}$`).join(" | ")} |`);
  w(`| :-- | ${TRUE_CORRELATIONS.map(() => ":--").join(" | ")} |`);
  for (const p of PER_ITEM) {
    const cells = TRUE_CORRELATIONS.map((r) => {
      const l = minimumLength(p.value, r, cj);
      return l === null ? "—" : `${l}（${minutes(l)}）`;
    });
    w(`| ${p.value} | ${cells.join(" | ")} |`);
  }
  w();
}
w("---");
w();
w(`## 結果2：項目数ごとの、基準を満たす確率と観測される相関（$\\text{rel}_{\\text{CJ}} = ${CJ_MAIN}$）`);
w();
w("各セルは「基準を満たした割合／$\\hat\\rho$ の平均（5〜95%範囲）」です。最終列は観測相関の理論上の上限 $r_{\\text{true}}\\sqrt{\\text{rel}_{\\text{A}}\\cdot\\text{rel}_{\\text{CJ}}}$ を $r_{\\text{true}} = 0.9$ で計算したものです。");
w();
for (const p of PER_ITEM) {
  w(`### 1項目あたりの信頼性 ${p.value}（${p.label}）`);
  w();
  w(`| 項目数 | 所要時間 | ${TRUE_CORRELATIONS.map((r) => `$r_{\\text{true}}=${r}$`).join(" | ")} | 上限（$r_{\\text{true}}=0.9$） |`);
  w(`| :-- | :-- | ${TRUE_CORRELATIONS.map(() => ":--").join(" | ")} | :-- |`);
  for (const length of LENGTHS) {
    const cells = TRUE_CORRELATIONS.map((r) => {
      const res = results.get(key(p.value, length, r, CJ_MAIN))!;
      return `${pct(res.passRate)}／${f2(res.rho.mean)}（${f2(res.rho.p05)}〜${f2(res.rho.p95)}）`;
    });
    const ceiling = attenuationCeiling(0.9, spearmanBrown(p.value, length), CJ_MAIN);
    w(`| ${length} | ${minutes(length)} | ${cells.join(" | ")} | ${f2(ceiling)} |`);
  }
  w();
}
w("---");
w();
w(`## 結果3：希薄化補正後の値（$\\text{rel}_{\\text{CJ}} = ${CJ_MAIN}$、$r_{\\text{true}} = 0.9$）`);
w();
w("$\\hat\\rho / \\sqrt{\\hat\\alpha \\cdot \\text{rel}_{\\text{CJ}}}$ の中央値（5〜95%範囲）です。α̂ が 0 に近い試行では補正値が発散するため、平均ではなく中央値で示します。補正後の値は項目数が少なくても真の相関の近くに来ますが、項目数が少ないほど、また1項目あたりの信頼性が低いほどばらつきます。");
w();
w(`| 項目数 | ${PER_ITEM.map((p) => `信頼性 ${p.value}`).join(" | ")} |`);
w(`| :-- | ${PER_ITEM.map(() => ":--").join(" | ")} |`);
for (const length of LENGTHS) {
  const cells = PER_ITEM.map((p) => {
    const d = results.get(key(p.value, length, 0.9, CJ_MAIN))!.disattenuated;
    return `${f2(d.median)}（${f2(d.p05)}〜${f2(d.p95)}）`;
  });
  w(`| ${length} | ${cells.join(" | ")} |`);
}
w();

fs.writeFileSync(path.join(outDir, "README.md"), lines.join("\n"));
console.log(`wrote ${path.relative(process.cwd(), path.join(outDir, "README.md"))}`);
