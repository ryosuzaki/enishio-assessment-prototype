#!/usr/bin/env node
// ビルド成果物（.next/static/ 配下）に、アセスメントの正答鍵（flaw_id 等の識別子）が
// 漏れていないかを機械的に検証するスクリプト。
//
// AGENTS.md の守ること #5 に対応する回帰チェック:
//   `*.server.ts` はサーバ専用モジュールであり、クライアントコンポーネントから
//   import されるとビルド成果物（クライアントバンドル）に正答鍵が含まれてしまい、
//   受検者が DevTools で全て読めてしまう。
//
// 使い方:
//   npm run build && npm run check:no-leak

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const dataDir = path.join(projectRoot, "src", "data");
const staticDir = path.join(projectRoot, ".next", "static");

/**
 * 与えられたディレクトリ配下のファイルを再帰的に列挙する。
 */
function listFilesRecursive(dir) {
  const results = [];
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * src/data/*.server.ts から、識別子（flaw_id 等の正答鍵）を抽出する。
 */
function extractSecretIdentifiers() {
  if (!existsSync(dataDir)) {
    return [];
  }

  const serverFiles = listFilesRecursive(dataDir).filter((f) => f.endsWith(".server.ts"));

  const identifiers = new Set();

  for (const file of serverFiles) {
    const content = readFileSync(file, "utf8");

    // パターン1: flaw_id: "FLAW-01" のような明示的なキー代入
    const keyValuePattern = /flaw_id:\s*["'`]([^"'`]+)["'`]/g;
    for (const match of content.matchAll(keyValuePattern)) {
      identifiers.add(match[1]);
    }

    // パターン2: FLAW-xxx / VALID-xxx 形式の識別子リテラル全般
    // (flaw_id 以外のプロパティ経由で持ち回されるケースも拾う)
    const literalPattern = /["'`]((?:FLAW|VALID)-[A-Z0-9-]+)["'`]/g;
    for (const match of content.matchAll(literalPattern)) {
      identifiers.add(match[1]);
    }
  }

  return Array.from(identifiers);
}

function main() {
  const identifiers = extractSecretIdentifiers();

  if (identifiers.length === 0) {
    console.error(
      "警告: src/data/*.server.ts から識別子（flaw_id 等）が1件も抽出できなかった。" +
        " 抽出パターンが実装と一致しているか、または src/data/*.server.ts が存在するか確認すること。"
    );
    process.exit(1);
  }

  if (!existsSync(staticDir)) {
    console.error(
      `エラー: ${path.relative(projectRoot, staticDir)} が存在しない（未ビルド）。` +
        " 先に `npm run build` を実行してからこのスクリプトを実行すること。"
    );
    process.exit(1);
  }

  const staticFiles = listFilesRecursive(staticDir);
  const leaks = [];

  for (const file of staticFiles) {
    let content;
    try {
      content = readFileSync(file, "utf8");
    } catch {
      // バイナリ等でutf8として読めないファイルはスキップ（識別子は含まれ得ない）
      continue;
    }

    for (const id of identifiers) {
      if (content.includes(id)) {
        leaks.push({ file: path.relative(projectRoot, file), id });
      }
    }
  }

  if (leaks.length > 0) {
    console.error(
      `NG: クライアントバンドルに正答鍵の識別子が ${leaks.length} 件漏洩している:\n`
    );
    for (const leak of leaks) {
      console.error(`  - ${leak.id}  (${leak.file})`);
    }
    console.error(
      "\nsrc/data/*.server.ts が \"use client\" コンポーネントから import されていないか確認すること（AGENTS.md 守ること #5）。"
    );
    process.exit(1);
  }

  console.log(
    `OK: ${identifiers.length}件の識別子（${path.relative(projectRoot, dataDir)}/*.server.ts 由来）がクライアントバンドル（${path.relative(projectRoot, staticDir)}）に含まれていないことを確認した。`
  );
  process.exit(0);
}

main();
