/**
 * 共通尺度化エンジン（2層）の合成データ検証。仕様: specs/004-equating-simulation/spec.md
 *
 * ここで確かめるのは「統計的な仕組みとして筋が通っているか」であって、
 * LLM 判定器が実際にこの生成モデルの仮定を満たすかではない（spec §1.3）。
 */
import { fitBradleyTerry, type Comparison } from "./bradley-terry";
import { createRng, type Rng } from "./random";

// ---------------------------------------------------------------------------
// 集計の道具
// ---------------------------------------------------------------------------

export function mean(xs: number[]): number {
  return xs.reduce((s, x) => s + x, 0) / xs.length;
}

export function sd(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
}

/** 同順位は平均順位にする */
function ranks(xs: number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const r = new Array<number>(xs.length);
  let i = 0;
  while (i < order.length) {
    let j = i;
    while (j + 1 < order.length && order[j + 1].x === order[i].x) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[order[k].i] = avg;
    i = j + 1;
  }
  return r;
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxy / Math.sqrt(sxx * syy);
}

export function spearman(xs: number[], ys: number[]): number {
  return pearson(ranks(xs), ranks(ys));
}

export function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export interface Summary {
  mean: number;
  p05: number;
  p95: number;
}

export function summarize(xs: number[]): Summary {
  return { mean: mean(xs), p05: quantile(xs, 0.05), p95: quantile(xs, 0.95) };
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

/** 判定器の勝敗。効用の差にロジスティックな判断ノイズが乗る */
function judge(rng: Rng, ui: number, uj: number, discrimination: number): boolean {
  return rng.next() < logistic(discrimination * (ui - uj));
}

// ---------------------------------------------------------------------------
// 実験1：課題難易度の交絡
// ---------------------------------------------------------------------------

export interface Experiment1Params {
  /** 受講者数（PoC の有効完了60名に合わせる） */
  learners: number;
  /** 1人あたりの一対比較の回数 */
  comparisonsPerLearner: number;
  /** 判定器に残る難易度の影響（0＝完全に除去、1＝絶対採点と同じだけ残る） */
  lambda: number;
  /** 絶対採点の測定ノイズ（実力と同じ単位の標準偏差） */
  absoluteNoise: number;
  /** 一対比較の判定の鋭さ（ロジスティックの傾き） */
  discrimination: number;
}

export const DEFAULT_EXPERIMENT1: Experiment1Params = {
  learners: 60,
  comparisonsPerLearner: 10,
  lambda: 0,
  absoluteNoise: 1.0,
  // 標準正規の判断ノイズを持つ probit 判定とほぼ同じ鋭さ（1.7）
  discrimination: 1.7,
};

export interface Experiment1Replicate {
  /** 絶対採点（自分の課題で 0〜5 バンド）と真の実力の順位相関 */
  absolute: number;
  /** 一対比較＋Bradley-Terry と真の実力の順位相関 */
  pairwise: number;
}

/**
 * 生成モデル:
 *   真の実力 θ_i ~ N(0,1)、各受講者だけに出る課題の難易度 b_i ~ N(0,1)（課題の共有なし）
 *   絶対採点: band_i = clamp(round(2.5 + θ_i − b_i + ε), 0, 5)、ε ~ N(0, absoluteNoise)
 *   一対比較: 判定器が見る効用 u_i = θ_i − λ b_i、P(i が勝つ) = logistic(discrimination (u_i − u_j))
 */
export function runExperiment1Once(params: Experiment1Params, rng: Rng): Experiment1Replicate {
  const n = params.learners;
  const theta = Array.from({ length: n }, () => rng.normal());
  const difficulty = Array.from({ length: n }, () => rng.normal());

  const band = theta.map((t, i) => {
    const raw = 2.5 + t - difficulty[i] + params.absoluteNoise * rng.normal();
    return Math.min(5, Math.max(0, Math.round(raw)));
  });

  const utility = theta.map((t, i) => t - params.lambda * difficulty[i]);
  const comparisons: Comparison[] = [];
  // 1人あたり k 回になるよう、各受講者が k/2 人を相手に選ぶ（選ばれる側でも数える）
  const picks = Math.max(1, Math.round(params.comparisonsPerLearner / 2));
  for (let i = 0; i < n; i++) {
    for (const j of rng.sampleDistinct(n, picks, i)) {
      comparisons.push(
        judge(rng, utility[i], utility[j], params.discrimination)
          ? { winner: i, loser: j }
          : { winner: j, loser: i },
      );
    }
  }
  const { ability } = fitBradleyTerry(n, comparisons);

  return { absolute: spearman(theta, band), pairwise: spearman(theta, ability) };
}

export function runExperiment1(
  params: Experiment1Params,
  replicates: number,
  seed: number,
): { absolute: Summary; pairwise: Summary } {
  const rng = createRng(seed);
  const results = Array.from({ length: replicates }, () => runExperiment1Once(params, rng));
  return {
    absolute: summarize(results.map((r) => r.absolute)),
    pairwise: summarize(results.map((r) => r.pairwise)),
  };
}

// ---------------------------------------------------------------------------
// 実験2：実力変化と判定器のズレの切り分け
// ---------------------------------------------------------------------------

export type Experiment2Scenario = "ability_gain" | "judge_drift" | "both";

export interface Experiment2Params {
  learnersPerCohort: number;
  /** コホート内の一対比較（1人あたり） */
  comparisonsPerLearner: number;
  /** コホートBの各受講者がコホートAの受講者と比べられる回数（2コホートをつなぐ） */
  crossComparisonsPerLearner: number;
  /** 実力が上がるシナリオでの、コホートBの平均の伸び（実力の標準偏差単位） */
  abilityGain: number;
  /** コホートBの表層特徴（文章量など）の平均。実力とは独立 */
  styleShift: number;
  /** 版が変わった判定器が表層特徴に置く重み */
  driftWeight: number;
  /** 固定設問の得点の測定ノイズ（LLMを通さない決定論的採点。ノイズは設問の標本誤差） */
  anchorNoise: number;
  /** 人間専門家に判定させて凍結しておくペアの数（コホートAから無作為に抽出） */
  frozenPairs: number;
  /**
   * 凍結ペアに混ぜる「対照ペア」の数。同じ証拠の原文と、中身を変えずに表層特徴だけを
   * 強めた版の組。人間の判定は「優劣なし」なので、健全な判定器なら表層特徴の強い側を選ぶ率は 50%。
   */
  controlPairs: number;
  /** 対照ペアで強めた表層特徴の差（表層特徴の標準偏差単位） */
  controlStyleGap: number;
  discrimination: number;
}

export const DEFAULT_EXPERIMENT2: Experiment2Params = {
  learnersPerCohort: 60,
  comparisonsPerLearner: 10,
  crossComparisonsPerLearner: 5,
  abilityGain: 0.5,
  styleShift: 1.0,
  driftWeight: 0.6,
  anchorNoise: 0.6,
  frozenPairs: 100,
  controlPairs: 30,
  controlStyleGap: 2.0,
  discrimination: 1.7,
};

export interface Experiment2Replicate {
  /** 第1層（A・Bを結合した Bradley-Terry）が示す、Bの伸び（Aの標準偏差単位） */
  layer1Gain: number;
  /** 第2層(1) 固定設問が示す、Bの伸び（Aの標準偏差単位） */
  anchorGain: number;
  /** 第2層(2) 凍結ペアで、いまの判定器が人間判定と一致した割合 */
  frozenAgreement: number;
  /** 同じ凍結ペアで、基準期の判定器が人間判定と一致した割合（比較の基準） */
  frozenAgreementBaseline: number;
  /** 対照ペアで、いまの判定器が表層特徴の強い側を選んだ割合（健全なら 0.5 前後） */
  controlStylePreference: number;
}

/**
 * 生成モデル:
 *   コホートA: θ ~ N(0,1)、表層特徴 v ~ N(0,1)。コホートB: θ ~ N(gain,1)、v ~ N(styleShift,1)
 *   基準期の判定器 v1 の効用: θ。版が変わった判定器 v2 の効用: θ + driftWeight·v
 *   コホートA内の比較は基準期に v1 で済んでいる。コホートB内とA–B間の比較は、いまの判定器で行う
 *   固定設問: s = θ + ε（LLMを通さない）
 *   凍結ペア: コホートAのペアを人間専門家（効用 θ）が判定して保存。いまの判定器で再判定して一致率を見る
 */
export function runExperiment2Once(
  scenario: Experiment2Scenario,
  params: Experiment2Params,
  rng: Rng,
): Experiment2Replicate {
  const n = params.learnersPerCohort;
  const gain = scenario === "judge_drift" ? 0 : params.abilityGain;
  const drift = scenario === "ability_gain" ? 0 : params.driftWeight;

  const thetaA = Array.from({ length: n }, () => rng.normal());
  const styleA = Array.from({ length: n }, () => rng.normal());
  const thetaB = Array.from({ length: n }, () => gain + rng.normal());
  const styleB = Array.from({ length: n }, () => params.styleShift + rng.normal());

  // 受講者 0..n-1 がコホートA、n..2n-1 がコホートB
  const theta = [...thetaA, ...thetaB];
  const style = [...styleA, ...styleB];
  const v1 = (i: number) => theta[i];
  const current = (i: number) => theta[i] + drift * style[i];

  const comparisons: Comparison[] = [];
  const addComparison = (i: number, j: number, utility: (k: number) => number) => {
    comparisons.push(
      judge(rng, utility(i), utility(j), params.discrimination)
        ? { winner: i, loser: j }
        : { winner: j, loser: i },
    );
  };
  const picks = Math.max(1, Math.round(params.comparisonsPerLearner / 2));
  for (let i = 0; i < n; i++) {
    for (const j of rng.sampleDistinct(n, picks, i)) addComparison(i, j, v1);
  }
  for (let i = 0; i < n; i++) {
    for (const j of rng.sampleDistinct(n, picks, i)) addComparison(n + i, n + j, current);
    for (const j of rng.sampleDistinct(n, params.crossComparisonsPerLearner)) {
      addComparison(n + i, j, current);
    }
  }
  const { ability } = fitBradleyTerry(2 * n, comparisons);
  const abilityA = ability.slice(0, n);
  const abilityB = ability.slice(n);
  const layer1Gain = (mean(abilityB) - mean(abilityA)) / sd(abilityA);

  const anchorA = thetaA.map((t) => t + params.anchorNoise * rng.normal());
  const anchorB = thetaB.map((t) => t + params.anchorNoise * rng.normal());
  const anchorGain = (mean(anchorB) - mean(anchorA)) / sd(anchorA);

  let agree = 0;
  let agreeBaseline = 0;
  for (let p = 0; p < params.frozenPairs; p++) {
    const [i, j] = rng.sampleDistinct(n, 2);
    const human = judge(rng, thetaA[i], thetaA[j], params.discrimination);
    const now = judge(
      rng,
      thetaA[i] + drift * styleA[i],
      thetaA[j] + drift * styleA[j],
      params.discrimination,
    );
    const baseline = judge(rng, thetaA[i], thetaA[j], params.discrimination);
    if (now === human) agree++;
    if (baseline === human) agreeBaseline++;
  }

  let preferStyle = 0;
  for (let p = 0; p < params.controlPairs; p++) {
    // 中身（θ）は同じなので、効用の差は表層特徴の差にかかる重みだけになる
    if (judge(rng, drift * params.controlStyleGap, 0, params.discrimination)) preferStyle++;
  }

  return {
    layer1Gain,
    anchorGain,
    frozenAgreement: agree / params.frozenPairs,
    frozenAgreementBaseline: agreeBaseline / params.frozenPairs,
    controlStylePreference: params.controlPairs > 0 ? preferStyle / params.controlPairs : Number.NaN,
  };
}

export interface Experiment2Result {
  layer1Gain: Summary;
  anchorGain: Summary;
  /** 第1層の伸び − 固定設問の伸び。判定器がズレていなければ 0 前後 */
  gainDiscrepancy: Summary;
  /** いまの判定器の一致率 − 基準期の判定器の一致率 */
  agreementChange: Summary;
  frozenAgreement: Summary;
  controlStylePreference: Summary;
}

export function runExperiment2(
  scenario: Experiment2Scenario,
  params: Experiment2Params,
  replicates: number,
  seed: number,
): Experiment2Result {
  const rng = createRng(seed);
  const rs = Array.from({ length: replicates }, () => runExperiment2Once(scenario, params, rng));
  return {
    layer1Gain: summarize(rs.map((r) => r.layer1Gain)),
    anchorGain: summarize(rs.map((r) => r.anchorGain)),
    gainDiscrepancy: summarize(rs.map((r) => r.layer1Gain - r.anchorGain)),
    agreementChange: summarize(rs.map((r) => r.frozenAgreement - r.frozenAgreementBaseline)),
    frozenAgreement: summarize(rs.map((r) => r.frozenAgreement)),
    controlStylePreference: summarize(rs.map((r) => r.controlStylePreference)),
  };
}
