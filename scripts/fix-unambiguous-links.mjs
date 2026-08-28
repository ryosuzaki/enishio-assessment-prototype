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

const mdFiles = getAllMarkdownFiles(WORKSPACE_ROOT);

function fixUnambiguousLinks() {
  let fixedCount = 0;

  for (const file of mdFiles) {
    let content = fs.readFileSync(file, "utf-8");
    let fileChanged = false;

    // Replace links
    const linkRegex = /(?<!!)(\[([^\]]*)\])\(([^)]+)\)/g;

    content = content.replace(linkRegex, (match, textPart, label, rawTarget) => {
      const trimmedTarget = rawTarget.trim();

      if (
        trimmedTarget.startsWith("http://") ||
        trimmedTarget.startsWith("https://") ||
        trimmedTarget.startsWith("mailto:") ||
        trimmedTarget.startsWith("#")
      ) {
        return match;
      }

      let pathPart = trimmedTarget;
      let hashPart = "";
      const hashIdx = pathPart.indexOf("#");
      if (hashIdx !== -1) {
        hashPart = pathPart.slice(hashIdx);
        pathPart = pathPart.slice(0, hashIdx);
      }

      if (!pathPart) return match;

      let decodedPath = pathPart;
      try {
        decodedPath = decodeURIComponent(pathPart);
      } catch (e) {}

      // Handle file:/// absolute paths
      if (decodedPath.startsWith("file:///c:/Users/ryo/Desktop/enishio-business/") || decodedPath.startsWith("file:///C:/Users/ryo/Desktop/enishio-business/")) {
        const absPath = decodedPath.replace(/^file:\/\/\/[cC]:\/Users\/ryo\/Desktop\/enishio-business\//, "");
        const targetFullPath = path.resolve(WORKSPACE_ROOT, absPath);
        if (fs.existsSync(targetFullPath)) {
          let newRel = path.relative(path.dirname(file), targetFullPath).replace(/\\/g, "/");
          if (!newRel.startsWith(".")) newRel = "./" + newRel;
          // Markdownのリンク先に生スペースが残るとリンクが壊れる（`](a b.md)` はパースに失敗する）。
          // 既存文書の規約（`financial/2026%20年度下期未踏アドバンスト事業/`）に合わせて %20 へ寄せる。
          newRel = newRel.replace(/ /g, "%20");
          fixedCount++;
          fileChanged = true;
          return `${textPart}(${newRel}${hashPart})`;
        }
      }

      const sourceDir = path.dirname(file);
      const targetFullPath = path.resolve(sourceDir, decodedPath);

      if (fs.existsSync(targetFullPath)) {
        return match; // Already valid
      }

      // Check candidate files with same basename
      const targetBasename = path.basename(decodedPath);
      const candidates = mdFiles.filter((f) => path.basename(f) === targetBasename);

      if (candidates.length === 1) {
        let newRelPath = path.relative(sourceDir, candidates[0]).replace(/\\/g, "/");
        // 生スペースを含むパスはMarkdownリンクとして壊れるため %20 へエンコードする
        // （例: `TeSH GAPファンド申請/` → `TeSH%20GAPファンド申請/`）。
        newRelPath = newRelPath.replace(/ /g, "%20");
        fixedCount++;
        fileChanged = true;
        console.log(`[FIX] ${path.relative(WORKSPACE_ROOT, file)}: ${trimmedTarget} -> ${newRelPath}${hashPart}`);
        return `${textPart}(${newRelPath}${hashPart})`;
      }

      return match;
    });

    if (fileChanged) {
      fs.writeFileSync(file, content, "utf-8");
    }
  }

  console.log(`\nTotal links fixed: ${fixedCount}`);
}

fixUnambiguousLinks();
