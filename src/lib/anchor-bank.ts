/**
 * アンカー項目バンクの読み込み。**サーバ専用**（`fs` を使う）。
 *
 * # 形式が2つある
 *
 * - **v2-sct（現行・`[D-83]`）**: 4段構成の疑似対話形式。
 *   段階1「採用可否」→ 段階2「懸念領域」→ 段階3「新情報を受けた判断の移動」→ 確信度。
 *   段階1の選択肢に答えを含めないことで「言われずに気づいたか」を測り、段階3を
 *   専門家パネルの応答分布で採点することで単一正答を排する。類型C（不備なし）を混ぜて
 *   テストワイズネス（とりあえず欠陥を探す戦略）を潰す。
 * - **v1-static（退役・`[D-83]`）**: 「暗黙の前提はどれか」を4択で当てさせる静的選択式。
 *   **較正・等化に用いてはならない。**選択肢が答えを含むため「気づく」という
 *   測定対象が消えており、対話側とは別の構成概念を測っている。加えて運用バンク20項目は
 *   正答が全問Aに固定されていた。再利用してよいのは `intro` / `proposal` /
 *   `hidden_premise` のテキスト（形式に依存しない素材）のみである。
 *
 * # 供給源の探索順
 *
 * 1. `src/data/anchors.v2.json`        運用バンク（v2）。`.gitignore` 済み・項目露出を避けるため
 * 2. `src/data/anchors.v2.sample.json` 公開デモ用サンプル（v2・3項目・リポジトリ同梱）
 * 3. `src/data/anchors.json`           運用バンク（v1・**退役**）
 * 4. `src/data/anchors.sample.json`    公開デモ用サンプル（v1・**退役**）
 *
 * どれを読んだかは `source` で返し、画面にも明示する（実装指示書 §W6「未実装を実装済みに
 * 見せない」）。**サンプルを運用バンクに見せない。退役形式を現行形式に見せない。**
 */
import fs from "fs";
import path from "path";

export interface AnchorOption {
  key: string;
  text: string;
  note?: string;
}

/** 段階3のリッカート目盛り（-2..+2） */
export interface AnchorScalePoint {
  value: number;
  label: string;
}

/**
 * 段階3の専門家パネル分布。**採点鍵そのもの**であり受検者へ返してはならない。
 * `status: "mock"` の間はダミー値であり、採点値として用いない（`[D-82]` 決定3）。
 */
export interface AnchorPanel {
  status: "mock" | "provisional" | "final";
  n: number;
  /** キーは "-2".."2"、値はその選択肢を選んだパネリスト数 */
  distribution: Record<string, number>;
  note?: string;
}

export interface AnchorRecordV2 {
  anchor_id: string;
  format_version: "v2-sct";
  family: string;
  anchor_status?: string;
  /** `seeded_premise`: 前提を仕込んだ項目 ／ `no_defect`: 類型C（不備なし） */
  item_kind: "seeded_premise" | "no_defect";
  title: string;
  intro: string;
  proposal: string;
  hidden_premise: string | null;
  stage1: { question: string; note?: string; options: AnchorOption[]; correct_key: string };
  /** 類型Cでは段階2を出題しないため null */
  stage2: { question: string; note?: string; options: AnchorOption[] } | null;
  stage3: {
    new_information: string;
    question: string;
    scale: AnchorScalePoint[];
    panel: AnchorPanel;
  };
  /**
   * 段階3'（任意）: **新しい情報を含まない反論**を出し、同じ設問を再提示する。
   *
   * 含まれるのは自信の表明・一般論への訴え・同調圧力だけであるから、ここで判断が動けば
   * 新情報への適応ではなく迎合である。段階3（新情報あり）との対比が「動くべきときに動き、
   * 動くべきでないときに動かない」＝適正依存（Appropriate Reliance）の測度になる。
   *
   * **採点は同一受検者内の差分のみで、専門家パネルを必要としない。**段階3の採点鍵が
   * まだダミーである間も、この軸だけは実データとして出せる [D-83]。
   *
   * **全項目には付けない。**どの項目に付くかを読まれると「2回目は動かない」を学習され、
   * 測れなくなる（露出による劣化）。
   */
  stage3b: {
    pushback: string;
    question: string;
    note?: string;
    scoring?: Record<string, unknown>;
  } | null;
  confidence_scale?: string;
  cheat_notes?: string;
  distractor_notes?: string;
  metadata?: string;
}

/** 退役形式（`[D-83]`）。読み込みは残すが較正には使わない。 */
export interface AnchorRecordV1 {
  anchor_id: string;
  format_version?: "v1-static";
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

export type AnchorRecord = AnchorRecordV1 | AnchorRecordV2;

export function isV2(a: AnchorRecord): a is AnchorRecordV2 {
  return (a as AnchorRecordV2).format_version === "v2-sct";
}

export type AnchorBankSource =
  | "operational_v2"
  | "demo_sample_v2"
  | "operational_v1_retired"
  | "demo_sample_v1_retired"
  | "missing";

/** その供給源が退役形式か（画面と seed スクリプトが警告を出すために使う） */
export function isRetiredSource(source: AnchorBankSource): boolean {
  return source === "operational_v1_retired" || source === "demo_sample_v1_retired";
}

export interface AnchorBank {
  anchors: AnchorRecord[];
  source: AnchorBankSource;
}

export const OPERATIONAL_BANK_PATH_V2 = "src/data/anchors.v2.json";
export const SAMPLE_BANK_PATH_V2 = "src/data/anchors.v2.sample.json";
export const OPERATIONAL_BANK_PATH_V1 = "src/data/anchors.json";
export const SAMPLE_BANK_PATH_V1 = "src/data/anchors.sample.json";

export const RETIRED_BANK_WARNING =
  `退役形式（v1-static）のバンクを読み込みました [D-83]。` +
  `選択肢が答えを含むため「気づく」という測定対象が失われており、**較正・等化に用いてはなりません。**` +
  `現行形式は ${SAMPLE_BANK_PATH_V2} を参照してください。`;

export const BANK_MISSING_MESSAGE =
  "アンカー項目バンクを読み込めませんでした。" +
  `同梱の ${SAMPLE_BANK_PATH_V2} が見つからないか壊れています。` +
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
 * v2 を優先し、無ければ退役形式へフォールバックする。
 *
 * 静的 import にしないのは、ファイルの有無でビルドが落ちるのを避けるためと、
 * どちらを読んだかを実行時に利用者へ伝えるためである。
 */
export function loadAnchorBank(cwd: string = process.cwd()): AnchorBank {
  const candidates: [string, AnchorBankSource][] = [
    [OPERATIONAL_BANK_PATH_V2, "operational_v2"],
    [SAMPLE_BANK_PATH_V2, "demo_sample_v2"],
    [OPERATIONAL_BANK_PATH_V1, "operational_v1_retired"],
    [SAMPLE_BANK_PATH_V1, "demo_sample_v1_retired"],
  ];
  for (const [rel, source] of candidates) {
    const anchors = readBankFile(path.resolve(cwd, rel));
    if (anchors) return { anchors, source };
  }
  return { anchors: [], source: "missing" };
}

/**
 * 選択肢をシャッフルし、提示順を返す。
 *
 * v1 運用バンクは**正答が全40問ともキー A に固定**されており、読まずに解けた（`[D-83]`）。
 * 提示順を固定しないこと、そして**提示順を記録すること**の両方が要る——記録しなければ
 * 後から応答を解釈できない。
 *
 * 段階1（採用可否）と段階3（リッカート）は順序に意味があるためシャッフルしない。
 */
export function shuffleOptions<T extends AnchorOption>(
  options: T[],
  rng: () => number = Math.random
): { options: T[]; order: string } {
  const shuffled = [...options];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { options: shuffled, order: shuffled.map((o) => o.key).join(",") };
}
