/**
 * 乱数種つき乱数（mulberry32）。
 *
 * シミュレーションの結果を誰でも再現できるよう、`Math.random` は使わない。
 */
export interface Rng {
  /** [0, 1) の一様乱数 */
  next(): number;
  /** 標準正規乱数（Box-Muller） */
  normal(): number;
  /** 0..n-1 から、除外する値を除いて重複なく k 個選ぶ */
  sampleDistinct(n: number, k: number, exclude?: number): number[];
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  let spareNormal: number | null = null;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const normal = (): number => {
    if (spareNormal !== null) {
      const z = spareNormal;
      spareNormal = null;
      return z;
    }
    let u = 0;
    while (u === 0) u = next();
    const v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spareNormal = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };

  const sampleDistinct = (n: number, k: number, exclude?: number): number[] => {
    const pool: number[] = [];
    for (let i = 0; i < n; i++) if (i !== exclude) pool.push(i);
    const take = Math.min(k, pool.length);
    // 部分的な Fisher-Yates
    for (let i = 0; i < take; i++) {
      const j = i + Math.floor(next() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, take);
  };

  return { next, normal, sampleDistinct };
}
