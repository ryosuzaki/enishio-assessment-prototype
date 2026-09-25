import fs from "fs";
import path from "path";

const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

function getAllMarkdownFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".git" ||
        entry.name === ".next" ||
        entry.name === ".turbo" ||
        entry.name === ".gemini"
      ) {
        continue;
      }
      getAllMarkdownFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function parseMarkdownLinks(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const links = [];

  const linkRegex = /(?:^|[^!])\[([^\]]*)\]\(([^)]+)\)/g;

  lines.forEach((line, lineIdx) => {
    let match;
    while ((match = linkRegex.exec(line)) !== null) {
      const text = match[1];
      let rawTarget = match[2].trim();

      const spaceIdx = rawTarget.indexOf(" ");
      if (spaceIdx !== -1 && (rawTarget.endsWith('"') || rawTarget.endsWith("'"))) {
        rawTarget = rawTarget.slice(0, spaceIdx);
      }

      links.push({
        sourceFile: filePath,
        lineNumber: lineIdx + 1,
        text,
        rawTarget,
      });
    }
  });

  return links;
}

function checkLinks() {
  const mdFiles = getAllMarkdownFiles(WORKSPACE_ROOT);
  const allLinks = [];
  const brokenLinks = [];
  const validRelativeLinks = [];
  const externalLinks = [];

  for (const file of mdFiles) {
    const links = parseMarkdownLinks(file);
    allLinks.push(...links);

    for (const link of links) {
      const { sourceFile, rawTarget } = link;

      if (rawTarget.startsWith("http://") || rawTarget.startsWith("https://")) {
        externalLinks.push(link);
        continue;
      }

      if (rawTarget.startsWith("mailto:") || rawTarget.startsWith("#")) {
        continue;
      }

      let pathPart = rawTarget;
      const hashIdx = pathPart.indexOf("#");
      if (hashIdx !== -1) {
        pathPart = pathPart.slice(0, hashIdx);
      }

      if (!pathPart) {
        continue;
      }

      let decodedPath;
      try {
        decodedPath = decodeURIComponent(pathPart);
      } catch {
        decodedPath = pathPart;
      }

      const sourceDir = path.dirname(sourceFile);
      const targetFullPath = path.resolve(sourceDir, decodedPath);

      if (fs.existsSync(targetFullPath)) {
        validRelativeLinks.push({ ...link, resolvedPath: targetFullPath });
      } else {
        // Try searching if file exists anywhere in workspace with same basename
        const targetBasename = path.basename(decodedPath);
        const candidates = mdFiles.filter((f) => path.basename(f) === targetBasename);

        brokenLinks.push({
          ...link,
          resolvedPath: targetFullPath,
          attemptedPath: decodedPath,
          candidates,
        });
      }
    }
  }

  return {
    scannedFilesCount: mdFiles.length,
    totalLinksCount: allLinks.length,
    validRelativeCount: validRelativeLinks.length,
    brokenLinks,
    externalLinks,
  };
}

const res = checkLinks();

// Build markdown report
const lines = [];
lines.push("# 相互参照リンク整合チェック結果（T-23成果物）");
lines.push("");
lines.push("> **走査範囲**: `enishio-business`（親リポジトリ）、`products/enishio-education`、`products/enishio-assessment-prototype`");
lines.push(`> **走査日時**: ${new Date().toISOString()}`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 1. 走査概要");
lines.push("");
lines.push(`- **走査対象ファイル数**: ${res.scannedFilesCount} 件（Markdownファイル）`);
lines.push(`- **抽出された全リンク総数**: ${res.totalLinksCount} 件`);
lines.push(`- **有効な相対リンク数**: ${res.validRelativeCount} 件`);
lines.push(`- **外部URLリンク数**: ${res.externalLinks.length} 件（疎通検査対象外）`);
lines.push(`- **リンク切れ検出件数**: ${res.brokenLinks.length} 件`);
lines.push("");
lines.push("---");
lines.push("");
lines.push("## 2. リンク切れ一覧と対応判定");
lines.push("");

if (res.brokenLinks.length === 0) {
  lines.push("✅ **リンク切れは検出されませんでした（全相対リンクが正常に解決）。**");
} else {
  lines.push("| # | 参照元ファイル (行番号) | リンク文言 | 指定パス | 解決試行先 | 候補・判定 |");
  lines.push("|---|---|---|---|---|---|");
  res.brokenLinks.forEach((b, i) => {
    const relSource = path.relative(WORKSPACE_ROOT, b.sourceFile).replace(/\\/g, "/");
    const label = b.text.replace(/\|/g, "\\|");
    const target = b.rawTarget.replace(/\|/g, "\\|");
    const relResolved = path.relative(WORKSPACE_ROOT, b.resolvedPath).replace(/\\/g, "/");

    let status = "要判断（対象不在）";
    if (b.candidates.length === 1) {
      const candRel = path.relative(path.dirname(b.sourceFile), b.candidates[0]).replace(/\\/g, "/");
      status = `一意修正可 → \`${candRel}\``;
    } else if (b.candidates.length > 1) {
      status = `要判断（複数候補 ${b.candidates.length}件）`;
    }

    lines.push(`| ${i + 1} | \`${relSource}\` (L${b.lineNumber}) | [${label}] | \`${target}\` | \`${relResolved}\` | ${status} |`);
  });
}

lines.push("");
lines.push("---");
lines.push("");
lines.push("## 3. 外部URLリンク一覧（ネットワーク疎通検査対象外・記録用）");
lines.push("");
lines.push("| # | 参照元ファイル | リンク文言 | 外部URL |");
lines.push("|---|---|---|---|");
res.externalLinks.forEach((ext, i) => {
  const relSource = path.relative(WORKSPACE_ROOT, ext.sourceFile).replace(/\\/g, "/");
  const label = ext.text.replace(/\|/g, "\\|");
  const url = ext.rawTarget.replace(/\|/g, "\\|");
  lines.push(`| ${i + 1} | \`${relSource}\` (L${ext.lineNumber}) | ${label} | ${url} |`);
});
lines.push("");

const docsDir = path.resolve(process.cwd(), "docs");
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const outputPath = path.join(docsDir, "リンク整合チェック結果.md");
fs.writeFileSync(outputPath, lines.join("\n"), "utf-8");

console.log(`Report generated at: ${outputPath}`);
console.log(`Broken links: ${res.brokenLinks.length}`);
