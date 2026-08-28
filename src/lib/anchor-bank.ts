/**
 * アンカー項目バンクの読み込み。**サーバ専用**（`fs` を使う）。
 *
 * 2つの供給源を持ち、この順に探す:
 *
 * 1. `src/data/anchors.json`（運用バンク20項目）
 *    `.gitignore` されており **このリポジトリには含まれない。** 項目そのものを公開すると
 *    受検者が事前に読めてしまう（項目露出。MVP 2.6.2 が監視指標に据えているリスク）。
 *    生成は `npm run parse:anchors`（隣の enishio-education リポジトリの Markdown から）。
 *
 * 2. `src/data/anchors.sample.json`（公開デモ用サンプル2項目・リポジトリ同梱）
 *    **運用バンクの項目ではない。**公開リポジトリを clone しただけの利用者が、隣の
 *    非公開リポジトリを持たずに縦切りを端から端まで通せるようにするためのものである。
 *    どちらを読んだかは `source` で返し、画面にも明示する（実装指示書 §W6 の
 *    「未実装を実装済みに見せない」に対応する。**サンプル2項目を運用20項目に見せない**）。
 */
import fs from "fs";
import path from "path";

export interface AnchorOption {
  key: string;
  text: string;
  note?: string;
}

export interface AnchorRecord {
  anchor_id: string;
  family: string;
  anchor_status?: string;
  title: string;
  metadata: string;
  intro: string;
  proposal: string;
  hidden_premise?: string;
  confidence_scale?: string;
  cheat_notes?: string;
  distractor_notes?: string;
  q1: { question: string; options: AnchorOption[] };
  q2: { question: string; options: AnchorOption[] };
}

/** `operational`: 運用バンク20項目 ／ `demo_sample`: 同梱サンプル ／ `missing`: どちらも無い */
export type AnchorBankSource = "operational" | "demo_sample" | "missing";

export interface AnchorBank {
  anchors: AnchorRecord[];
  source: AnchorBankSource;
}

export const OPERATIONAL_BANK_PATH = "src/data/anchors.json";
export const SAMPLE_BANK_PATH = "src/data/anchors.sample.json";

export const BANK_MISSING_MESSAGE =
  "アンカー項目バンクを読み込めませんでした。" +
  `同梱の ${SAMPLE_BANK_PATH} が見つからないか壊れています。` +
  "リポジトリのファイルが欠けていないか確認してください。";

function readBankFile(absPath: string): AnchorRecord[] | null {
  if (!fs.existsSync(absPath)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(absPath, "utf-8"));
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as AnchorRecord[];
  } catch (e) {
    console.error(`アンカー項目バンクの読み込みに失敗しました (${absPath}):`, e);
    return null;
  }
}

/**
 * 運用バンクを優先し、無ければ同梱サンプルへフォールバックする。
 *
 * 静的 import にしないのは、ファイルの有無でビルドが落ちるのを避けるためと、
 * どちらを読んだかを実行時に利用者へ伝えるためである。
 */
export function loadAnchorBank(cwd: string = process.cwd()): AnchorBank {
  const operational = readBankFile(path.resolve(cwd, OPERATIONAL_BANK_PATH));
  if (operational) return { anchors: operational, source: "operational" };

  const sample = readBankFile(path.resolve(cwd, SAMPLE_BANK_PATH));
  if (sample) return { anchors: sample, source: "demo_sample" };

  return { anchors: [], source: "missing" };
}
