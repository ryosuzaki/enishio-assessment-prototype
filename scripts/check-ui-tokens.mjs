#!/usr/bin/env node
// UIに「AIが既定で書いてしまう装飾」が混入していないかを機械的に検査する。
//
// Skill（.claude/skills/ui-design/SKILL.md）に書いた決め事は守られたら嬉しい程度のもので、
// 守らなくても動く。ここで落とすことで初めて決め事が効く。
//
// **`src/app` 配下を全件検査する。**以前は scripts/ui-migration.json に挙げた
// 移行済みファイルだけを見ていた（未移行のダーク画面が既定パレットを直接使っており、
// 全件にすると常に落ちたため）。移行が終わって `remaining` が空になった時点で、
// あの名簿は「新しく足したファイルが検査されない穴」でしかなくなったので畳んだ。
//
// 使い方:
//   npm run check:ui

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** 検査対象の根。画面を構成するものはすべてこの下にある。 */
const TARGET_ROOTS = ["src/app"];

/** Tailwind 既定パレットの直接指定。役割ではなく見た目で色を選んだ印。 */
const DEFAULT_PALETTE =
  /\b(?:bg|text|border|ring|from|via|to|outline|divide|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/;

const RULES = [
  {
    id: "gradient",
    pattern: /\bbg-gradient-to-|\bbg-linear-to-/,
    message: "グラデーション背景は使わない。面は単色、強調は面積と文字の太さで作る",
  },
  {
    id: "glow-shadow",
    pattern: /\bshadow-(?:[a-z]+-\d{2,3}(?:\/\d{1,3})?|lg|xl|2xl)\b/,
    message: "色付きの影・大きな影は使わない。階層は罫線（border-line）と地色の1段差で表す",
  },
  {
    id: "glass",
    pattern: /\bglass-panel\b|\bbackdrop-blur/,
    message: "glassmorphism は使わない。背景が透けると数値の可読性が落ちる",
  },
  {
    id: "pulse",
    pattern: /\banimate-pulse\b/,
    message: "点滅による装飾は使わない。動作中であることは静的な表示で足りる（ローディングの animate-spin は可）",
  },
  {
    id: "default-palette",
    pattern: DEFAULT_PALETTE,
    message:
      "Tailwind 既定パレットを直接使わない。globals.css の役割名（surface / line / ink / accent / positive / caution / critical）を使う",
  },
  {
    id: "uppercase-label",
    pattern: /\buppercase\b/,
    message: "英大文字のマイクロラベルは使わない。日本語の見出しを小さく淡く置く",
  },
  {
    // 文字の大きさを素の値で書くと、書くたびに判断が発生し、画面ごとに 11px と 12px と
    // 13px が混ざる。混ざった瞬間に「揃っていない画面」になる（`[D-102]`）。
    id: "raw-font-size",
    pattern: /\btext-(?:xs|sm|base|lg|xl|[2-9]xl|\[[0-9.]+(?:px|rem|em)\])\b/,
    message:
      "文字サイズを素の値で書かない。globals.css のスケール（display / title / section / body / caption / label / data）を使う",
  },
  {
    id: "big-radius",
    pattern: /\brounded-(?:xl|2xl|3xl)\b/,
    message: "角丸は rounded-card / rounded-chip の2段階に揃える",
  },
  {
    id: "decorative-icon",
    pattern: /\b(?:Sparkles|Zap|Rocket|Wand2|Star)\b/,
    message: "装飾目的のアイコンは使わない（Sparkles / Zap など）。意味を運ぶアイコンだけ残す",
  },
  {
    // 矢印（U+2190-21FF、および Dingbats の U+2794 以降）は除く——工程の順序を示す
    // 「レビュー完了 ➔ 暫定判断へ進む」は装飾ではなく文言の一部であり、E2E が掴む文字列でもある。
    // 禁止したいのは ⚡ ✨ 🚀 ✅ ⚠️ のような、意味を色と形に肩代わりさせる記号のほう。
    id: "emoji",
    pattern: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{2793}\u{2B00}-\u{2BFF}]/u,
    message: "絵文字・装飾記号は使わない。状態は Badge で、程度は語で表す（工程を示す矢印は可）",
  },
];

/** コメント行は検査しない。禁止パターンそのものを説明するために書いてあることがあるため。 */
const COMMENT_LINE = /^\s*(?:\/\/|\/\*|\*|\{\/\*)/;

function listTargets() {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) {
        walk(abs);
      } else if (/\.(tsx?|css)$/.test(name)) {
        files.push(abs);
      }
    }
  };
  for (const root of TARGET_ROOTS) {
    const abs = path.join(projectRoot, root);
    try {
      statSync(abs);
    } catch {
      console.error(`[設定エラー] 検査対象のパスが存在しない: ${root}`);
      process.exit(2);
    }
    walk(abs);
  }
  return files;
}

const violations = [];
for (const file of listTargets()) {
  const rel = path.relative(projectRoot, file).split(path.sep).join("/");
  const lines = readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (COMMENT_LINE.test(line)) return;
    for (const rule of RULES) {
      const m = line.match(rule.pattern);
      if (m) violations.push({ rel, line: i + 1, rule, matched: m[0], text: line.trim() });
    }
  });
}

if (violations.length === 0) {
  console.log(`[OK] UIトークン検査: ${listTargets().length} ファイル、違反なし`);
  process.exit(0);
}

console.error(`[NG] UIトークン検査: ${violations.length} 件の違反\n`);
for (const v of violations) {
  console.error(`${v.rel}:${v.line}  [${v.rule.id}] "${v.matched}"`);
  console.error(`  ${v.rule.message}`);
  console.error(`  > ${v.text.slice(0, 120)}\n`);
}
console.error("決め事は .claude/skills/ui-design/SKILL.md にある。");
process.exit(1);
