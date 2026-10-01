/**
 * 固定設問（共通アンカー）の項目数の合成データ検証。仕様: specs/005-anchor-length-simulation/spec.md
 *
 * 1項目あたりの信頼性は実際の設問で決まる量なので、ここでは決めずに振る（spec §1.3）。
 */
import { createRng, type Rng } from "../equating/random";
import { mean, quantile, spearman, summarize, type Summary } from "../equating/simulation";

// ---------------------------------------------------------------------------
// 統計の道具
// ---------------------------------------------------------------------------

function variance(xs: number[]): number {
  const m = mean(xs);
  return xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1);
}

/** Cronbach の α。scores[j][i] は項目 j・受講者 i の得点 */
export function cronbachAlpha(scores: number[][]): number {
  const k = scores.length;
  const n = scores[0].length;
  const totals = new Array<number>(n).fill(0);
  for (const item of scores) for (let i = 0; i < n; i++) totals[i] += item[i];
  const itemVar = scores.reduce((s, item) => s + variance(item), 0);
  return (k / (k - 1)) * (1 - itemVar / variance(totals));
}

/** L 項目の信頼性から、1項目あたりの信頼性を逆算する（Spearman-Brown の逆） */
export function perItemReliability(alpha: number, length: number): number {
  return alpha / (length - (length - 1) * alpha);
}

/** 1項目あたりの信頼性から、L 項目の信頼性を出す（Spearman-Brown） */
export function spearmanBrown(perItem: number, length: number): number {
  return (length * perItem) / (1 + (length - 1) * perItem);
}

/** Spearman 相関の95%信頼区間（Fisher z、標準誤差は Bonett & Wright 2000） */
export function spearmanCi(rho: number, n: number): { lower: number; upper: number } {
  const z = Math.atanh(Math.max(-0.999999, Math.min(0.999999, rho)));
  const se = Math.sqrt((1 + (rho * rho) / 2) / (n - 3));
  return { lower: Math.tanh(z - 1.96 * se), upper: Math.tanh(z + 1.96 * se) };
}

// ---------------------------------------------------------------------------
// 生成モデル
// ---------------------------------------------------------------------------

/** 4段階（0〜3点）の閾値の、項目位置からの相対位置 */
const CATEGORY_OFFSETS = [-0.8, 0, 0.8];
/** 項目位置のばらつき（潜在反応の尺度で） */
const ITEM_LOCATION_SD = 0.7;

/**
 * 固定設問の応答を生成する。潜在反応 y = λθ + √(1-λ²)ε を、項目ごとの閾値で 0〜3 点に切る。
 * 項目どうしは θ を通してのみ相関する（1状況文1設問）。
 */
export function generateAnchorScores(rng: Rng, theta: number[], length: number, loading: number): number[][] {
  const noise = Math.sqrt(1 - loading * loading);
  const scores: number[][] = [];
  for (let j = 0; j < length; j++) {
    const location = ITEM_LOCATION_SD * rng.normal();
    const item = theta.map((t) => {
      const y = loading * t + noise * rng.normal();
      return CATEGORY_OFFSETS.reduce((s, c) => s + (y > location + c ? 1 : 0), 0);
    });
    scores.push(item);
  }
  return scores;
}

/**
 * 1項目あたりの信頼性（実現値）が目標になる負荷 λ を二分法で求める。
 * 評価のたびに同じ乱数種を使い、λ について単調にする。
 */
export function calibrateLoading(targetPerItem: number, seed = 1, n = 20000, length = 20): number {
  const realized = (loading: number): number => {
    const rng = createRng(seed);
    const theta = Array.from({ length: n }, () => rng.normal());
    return perItemReliability(cronbachAlpha(generateAnchorScores(rng, theta, length, loading)), length);
  };
  let lo = 0.01;
  let hi = 0.99;
  for (let iter = 0; iter < 30; iter++) {
    const mid = (lo + hi) / 2;
    if (realized(mid) < targetPerItem) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// 試行
// ---------------------------------------------------------------------------

export interface AnchorLengthParams {
  /** 受講者数（到達基準の受講者60名） */
  learners: number;
  /** 固定設問の項目数 L */
  length: number;
  /** 潜在反応への θ_A の負荷（calibrateLoading で 1項目あたりの信頼性から求める） */
  loading: number;
  /** θ_CJ と θ_A の真の相関 */
  trueCorrelation: number;
  /** θ_CJ の観測値の信頼性 */
  cjReliability: number;
}

/** 収束妥当性の旧基準（観測値。2層等化機構仕様 §5 #9 の D-121 以前） */
export const CRITERION = { rho: 0.6, lowerBound: 0.4 };
/** 補正後の値に移した基準：希薄化補正後の95%信頼区間の下限がこれを上回る */
export const DISATTENUATED_LOWER_BOUND = 0.4;

export interface AnchorLengthReplicate {
  rho: number;
  lower: number;
  passed: boolean;
  alpha: number;
  disattenuated: number;
  /** 観測値の区間の下限を √(α̂·rel_CJ) で割ったもの（信頼性を既知として扱う近似） */
  disattenuatedLower: number;
  passedDisattenuated: boolean;
}

export function runAnchorLengthOnce(params: AnchorLengthParams, rng: Rng): AnchorLengthReplicate {
  const { learners: n, trueCorrelation: r, cjReliability } = params;
  const cjError = Math.sqrt((1 - cjReliability) / cjReliability);
  const thetaCj: number[] = [];
  const thetaA: number[] = [];
  for (let i = 0; i < n; i++) {
    const z1 = rng.normal();
    const z2 = rng.normal();
    thetaCj.push(z1);
    thetaA.push(r * z1 + Math.sqrt(1 - r * r) * z2);
  }
  const cjObserved = thetaCj.map((t) => t + cjError * rng.normal());
  const scores = generateAnchorScores(rng, thetaA, params.length, params.loading);
  const anchorTotal = thetaA.map((_, i) => scores.reduce((s, item) => s + item[i], 0));

  const rho = spearman(cjObserved, anchorTotal);
  const { lower } = spearmanCi(rho, n);
  const alpha = cronbachAlpha(scores);
  const correction = Math.sqrt(Math.max(alpha, 1e-6) * cjReliability);
  const disattenuatedLower = lower / correction;
  return {
    rho,
    lower,
    passed: rho >= CRITERION.rho && lower > CRITERION.lowerBound,
    alpha,
    disattenuated: rho / correction,
    disattenuatedLower,
    passedDisattenuated: disattenuatedLower > DISATTENUATED_LOWER_BOUND,
  };
}

export interface AnchorLengthResult {
  passRate: number;
  passRateDisattenuated: number;
  rho: Summary;
  alpha: number;
  /** α̂ が 0 に近い試行で発散するので、平均ではなく中央値で要約する */
  disattenuated: { median: number; p05: number; p95: number };
}

export function runAnchorLength(params: AnchorLengthParams, reps: number, seed: number): AnchorLengthResult {
  const rng = createRng(seed);
  const rows = Array.from({ length: reps }, () => runAnchorLengthOnce(params, rng));
  return {
    passRate: rows.filter((r) => r.passed).length / reps,
    passRateDisattenuated: rows.filter((r) => r.passedDisattenuated).length / reps,
    rho: summarize(rows.map((r) => r.rho)),
    alpha: mean(rows.map((r) => r.alpha)),
    disattenuated: (() => {
      const d = rows.map((r) => r.disattenuated);
      return { median: quantile(d, 0.5), p05: quantile(d, 0.05), p95: quantile(d, 0.95) };
    })(),
  };
}

/** 観測相関の理論上の上限 r_true × √(rel_A × rel_CJ) */
export function attenuationCeiling(trueCorrelation: number, anchorReliability: number, cjReliability: number): number {
  return trueCorrelation * Math.sqrt(anchorReliability * cjReliability);
}
