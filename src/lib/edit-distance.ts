/**
 * Levenshtein 距離。artifact_edit_distance_series の実測値に使う（MVP 4.4）。
 *
 * 2行のローリング配列で O(min(n,m)) メモリ。成果物ドラフトは数十行なので十分。
 * 極端に長い入力は打ち切り、時系列が欠測になるより上限値を記録する。
 */
const MAX_LEN = 20000;

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length > MAX_LEN || b.length > MAX_LEN) {
    return Math.abs(a.length - b.length);
  }
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // 短いほうを内側の次元にする
  if (a.length > b.length) [a, b] = [b, a];

  let prev = new Array<number>(a.length + 1);
  let curr = new Array<number>(a.length + 1);
  for (let i = 0; i <= a.length; i++) prev[i] = i;

  for (let j = 1; j <= b.length; j++) {
    curr[0] = j;
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[i] = Math.min(curr[i - 1] + 1, prev[i] + 1, prev[i - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[a.length];
}
