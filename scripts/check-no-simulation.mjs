#!/usr/bin/env node
// 乱数で推論を模したシミュレーションがリポジトリへ戻ってきていないかを機械的に検査する。
//
// LLM 判定器や受講者の応答を乱数の生成モデルで置き換えると、結論は自分で置いた仮定から
// 出てくるのに、平均や 5〜95% 範囲が付いて実測のように見える。このリポジトリでは実際に
// 「統計モデルの成立性は合成データで事前検証済み」と公開 README に書き、仕様で未定義の量を
// 既知として置いた数字が判定基準に入った（設計原則 P-20・設計決定記録 D-130）。
//
// 禁止しているのは名前ではなく道具立てである。「合成データ検証」「感度分析」と名前を
// 変えても、シード付き乱数・正規乱数・sim スクリプトを持てばここで落ちる。
// 推定器などのコードの正しさは、手で組んだ決定的な入力で単体テストを書く。
//
// 使い方:
//   npm run check:no-simulation

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const selfRel = path.relative(projectRoot, fileURLToPath(import.meta.url)).split(path.sep).join("/");

/** ファイル名・ディレクトリ名を検査する根 */
const PATH_ROOTS = ["src", "scripts", "specs", "docs", "e2e"];
/** コードの中身を検査する根 */
const CODE_ROOTS = ["src", "scripts", "e2e"];

const SIMULATION_PATH = /simulat|monte-?carlo|synthetic/i;

/**
 * `Math.random` を使ってよい場所と、その理由。推論の模擬ではない用途に限る。
 * 足すときは、何のための乱数か（測定値を作っていないか）をここに書く。
 */
const RANDOM_ALLOWED = {
  "src/lib/anchor-bank.ts": "固定設問の選択肢の提示順をシャッフルする本番の出題機能。提示順はログに記録する",
  "src/integration/vertical-slice.integration.test.ts": "結合テストのユーザーIDが実行ごとに衝突しないようにするだけ",
};

const CODE_RULES = [
  {
    id: "seeded-rng",
    pattern: /\b(?:createRng|mulberry32|xorshift\w*|splitmix\w*|seedrandom|boxMuller|randn|randomNormal|gaussianRandom|sampleNormal)\b/,
    message: "シード付き乱数・正規乱数の生成器を置かない。推論を乱数で模す道具立てである",
  },
  {
    id: "fake-data-lib",
    pattern: /["'](?:@faker-js\/faker|faker|chance|random-js)["']/,
    message: "乱数でデータを作るライブラリを入れない",
  },
  {
    id: "math-random",
    pattern: /\bMath\.random\b/,
    message: "Math.random を使うなら、推論の模擬でないことを確かめて RANDOM_ALLOWED に理由つきで足す",
    allowed: (rel) => rel in RANDOM_ALLOWED,
  },
];

/** コメント行は検査しない。禁止している理由を説明するために名前を書くことがあるため。 */
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*)/;

function walk(root, onFile, onDir) {
  const abs = path.join(projectRoot, root);
  try {
    statSync(abs);
  } catch {
    return;
  }
  const visit = (dir) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules") continue;
      const p = path.join(dir, name);
      const rel = path.relative(projectRoot, p).split(path.sep).join("/");
      if (statSync(p).isDirectory()) {
        onDir?.(rel);
        visit(p);
      } else {
        onFile(rel, p);
      }
    }
  };
  visit(abs);
}

const violations = [];

for (const root of PATH_ROOTS) {
  const check = (rel) => {
    if (rel !== selfRel && SIMULATION_PATH.test(path.posix.basename(rel))) {
      violations.push({ where: rel, id: "simulation-path", message: "シミュレーションを名乗るファイル・ディレクトリを置かない" });
    }
  };
  walk(root, check, check);
}

const pkg = JSON.parse(readFileSync(path.join(projectRoot, "package.json"), "utf8"));
for (const [name, command] of Object.entries(pkg.scripts ?? {})) {
  if (command.includes(selfRel)) continue;
  if (/^sim(?::|$)/.test(name) || /simulat/i.test(command)) {
    violations.push({ where: `package.json scripts.${name}`, id: "sim-script", message: "シミュレーションを走らせる npm スクリプトを置かない" });
  }
}

let scanned = 0;
for (const root of CODE_ROOTS) {
  walk(root, (rel, abs) => {
    if (!/\.(?:[cm]?js|tsx?)$/.test(rel) || rel === selfRel) return;
    scanned++;
    readFileSync(abs, "utf8")
      .split(/\r?\n/)
      .forEach((line, i) => {
        if (COMMENT_LINE.test(line)) return;
        for (const rule of CODE_RULES) {
          if (rule.allowed?.(rel)) continue;
          const m = line.match(rule.pattern);
          if (m) violations.push({ where: `${rel}:${i + 1}`, id: rule.id, message: rule.message, text: line.trim() });
        }
      });
  });
}

if (violations.length === 0) {
  console.log(`[OK] シミュレーション検査: ${scanned} ファイル、違反なし`);
  process.exit(0);
}

console.error(`[NG] シミュレーション検査: ${violations.length} 件の違反\n`);
for (const v of violations) {
  console.error(`${v.where}  [${v.id}]`);
  console.error(`  ${v.message}`);
  if (v.text) console.error(`  > ${v.text.slice(0, 120)}`);
  console.error("");
}
console.error("事前に確かめてよいのは、数件の dry-run による動作確認と所要時間・メモリ・API 費用の計測だけである。");
console.error("手法の優劣や閾値は、本番の判定器を回した実測データの相関と信頼区間で決める（AGENTS.md 守ること 11）。");
process.exit(1);
