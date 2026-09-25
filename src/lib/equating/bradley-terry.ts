/**
 * Bradley-Terry モデルの推定（MM アルゴリズム、Hunter 2004）。
 *
 * P(i が j に勝つ) = π_i / (π_i + π_j)。能力値は log π を平均0に中心化して返す。
 *
 * 全勝・全敗の受講者がいると最尤推定は発散する。そこで各受講者に、強度1の仮想相手との
 * 1勝1敗（`priorGames` 回ずつ）を足して弱く正則化する。比較が増えるほどこの影響は薄れる。
 */
export interface Comparison {
  winner: number;
  loser: number;
}

export interface BradleyTerryResult {
  /** 各受講者の能力値（対数強度、平均0） */
  ability: number[];
  iterations: number;
  converged: boolean;
}

export function fitBradleyTerry(
  n: number,
  comparisons: Comparison[],
  options: { priorGames?: number; maxIterations?: number; tolerance?: number } = {},
): BradleyTerryResult {
  const priorGames = options.priorGames ?? 1;
  const maxIterations = options.maxIterations ?? 1000;
  const tolerance = options.tolerance ?? 1e-8;

  const wins = new Array<number>(n).fill(priorGames);
  // 対戦相手ごとの対戦数。疎なので Map で持つ
  const games: Map<number, number>[] = Array.from({ length: n }, () => new Map());
  for (const { winner, loser } of comparisons) {
    wins[winner] += 1;
    games[winner].set(loser, (games[winner].get(loser) ?? 0) + 1);
    games[loser].set(winner, (games[loser].get(winner) ?? 0) + 1);
  }

  let strength = new Array<number>(n).fill(1);
  let iterations = 0;
  let converged = false;

  while (iterations < maxIterations) {
    iterations++;
    const updated = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      // 仮想相手（強度1）との 2*priorGames 戦ぶん
      let denom = (2 * priorGames) / (strength[i] + 1);
      for (const [j, count] of games[i]) denom += count / (strength[i] + strength[j]);
      updated[i] = wins[i] / denom;
    }
    // 幾何平均を1に揃える（尺度の原点を固定する）
    const logMean = updated.reduce((s, x) => s + Math.log(x), 0) / n;
    const scale = Math.exp(logMean);
    let maxChange = 0;
    for (let i = 0; i < n; i++) {
      updated[i] /= scale;
      maxChange = Math.max(maxChange, Math.abs(Math.log(updated[i]) - Math.log(strength[i])));
    }
    strength = updated;
    if (maxChange < tolerance) {
      converged = true;
      break;
    }
  }

  const logs = strength.map(Math.log);
  const mean = logs.reduce((s, x) => s + x, 0) / n;
  return { ability: logs.map((x) => x - mean), iterations, converged };
}
