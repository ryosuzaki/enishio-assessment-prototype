const fs = require("fs");
const path = require("path");

function parseAnchorBankMarkdown(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const items = [];
  let currentItem = null;
  let currentSection = "";
  let currentQ1Options = [];
  let currentQ2Options = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith("### `ANCHOR-")) {
      if (currentItem && currentItem.anchor_id) {
        currentItem.q1 = { question: currentItem.q1?.question || "", options: currentQ1Options };
        currentItem.q2 = { question: currentItem.q2?.question || "", options: currentQ2Options };
        items.push(currentItem);
      }

      const match = line.match(/### `(ANCHOR-[AB]-\d+)`/);
      const anchorId = match ? match[1] : "";
      const family = anchorId.includes("-A-") ? "A" : "B";

      currentItem = {
        anchor_id: anchorId,
        family,
        anchor_status: "pretest",
        title: "",
        metadata: "",
        intro: "",
        proposal: "",
        hidden_premise: "",
        confidence_scale: "",
        cheat_notes: "",
        distractor_notes: "",
      };
      currentQ1Options = [];
      currentQ2Options = [];
      currentSection = "";
      continue;
    }

    if (!currentItem) continue;

    if (line.startsWith("- **一言タイトル**:")) {
      currentItem.title = line.replace("- **一言タイトル**:", "").trim();
    } else if (line.startsWith("- **メタデータ**:")) {
      currentItem.metadata = line.replace("- **メタデータ**:", "").trim();
    } else if (line.startsWith("- **導入文**:")) {
      currentItem.intro = line.replace("- **導入文**:", "").trim();
    } else if (line.startsWith("- **AI同僚の提案文**:")) {
      currentItem.proposal = line.replace("- **AI同僚の提案文**:", "").trim().replace(/^「|」$/g, "");
    } else if (line.startsWith("- **埋め込んだ前提の明示**:")) {
      currentItem.hidden_premise = line.replace("- **埋め込んだ前提の明示**:", "").trim();
    } else if (line.startsWith("- **設問1（主質問・4択）**:")) {
      currentSection = "q1";
      currentItem.q1 = {
        question: line.replace("- **設問1（主質問・4択）**:", "").trim(),
        options: [],
      };
    } else if (line.startsWith("- **設問2（深掘り・4択）**:")) {
      currentSection = "q2";
      currentItem.q2 = {
        question: line.replace("- **設問2（深掘り・4択）**:", "").trim(),
        options: [],
      };
    } else if (line.startsWith("- **確信度評定**:")) {
      currentSection = "confidence";
      currentItem.confidence_scale = line.replace("- **確信度評定**:", "").trim();
    } else if (line.startsWith("- **チート耐性検証**:")) {
      currentSection = "cheat";
      currentItem.cheat_notes = line.replace("- **チート耐性検証**:", "").trim();
    } else if (line.startsWith("- **ディストラクター設計メモ**:")) {
      currentSection = "distractor";
    } else if (line.startsWith("- `A`:") || line.startsWith("- `B`:") || line.startsWith("- `C`:") || line.startsWith("- `D`:")) {
      const optMatch = line.match(/- `([A-D])`:\s*(.*)/);
      if (optMatch) {
        const key = optMatch[1];
        const rawText = optMatch[2];
        const noteMatch = rawText.match(/(.*)【(.*)】/);
        const text = noteMatch ? noteMatch[1].trim() : rawText.trim();
        const note = noteMatch ? noteMatch[2].trim() : "";

        const optObj = { key, text, note };
        if (currentSection === "q1") {
          currentQ1Options.push(optObj);
        } else if (currentSection === "q2") {
          currentQ2Options.push(optObj);
        }
      }
    }
  }

  if (currentItem && currentItem.anchor_id) {
    currentItem.q1 = { question: currentItem.q1?.question || "", options: currentQ1Options };
    currentItem.q2 = { question: currentItem.q2?.question || "", options: currentQ2Options };
    items.push(currentItem);
  }

  return items;
}

const mdPath = path.resolve(__dirname, "../docs/共通アンカー項目バンク初版_T-05.md");
const outDir = path.resolve(__dirname, "../src/data");
const outPath = path.join(outDir, "anchors.json");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const parsed = parseAnchorBankMarkdown(mdPath);
fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2), "utf-8");
console.log(`Successfully parsed ${parsed.length} anchor items from Markdown to ${outPath}`);
