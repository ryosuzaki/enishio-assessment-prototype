/**
 * anchors.json を anchor_items テーブルへ投入する。
 *
 * anchor_responses は anchor_items への外部キーを持つため、これを流していないと
 * アンカー出題フローは必ず外部キー違反で落ちる。
 *
 * 全項目を anchor_status = "pretest" として投入する [D-51]。
 * 昇格判定（pretest → operational）は本縦切りのスコープ外（禁止事項3）。
 */
import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

interface AnchorRecord {
  anchor_id: string;
  family: string;
  title: string;
  metadata: string;
  intro: string;
  proposal: string;
  hidden_premise: string;
  confidence_scale: string;
  cheat_notes: string;
  distractor_notes: string;
  q1: { question: string; options: { key: string; text: string; note: string }[] };
  q2: { question: string; options: { key: string; text: string; note: string }[] };
}

async function main() {
  const jsonPath = path.resolve(process.cwd(), "src/data/anchors.json");
  if (!fs.existsSync(jsonPath)) {
    console.error(`anchors.json がありません: ${jsonPath}`);
    console.error("先に 'npm run parse:anchors' を実行してください。");
    process.exit(1);
  }

  const items: AnchorRecord[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`=== anchor_items の投入（${items.length}項目） ===`);

  for (const item of items) {
    await prisma.anchorItem.upsert({
      where: { anchor_id: item.anchor_id },
      // anchor_status は更新しない。運用中に operational へ昇格した項目を
      // 再投入で pretest へ巻き戻さないため。
      update: { family: item.family, content: item as any },
      create: {
        anchor_id: item.anchor_id,
        family: item.family,
        anchor_status: "pretest",
        content: item as any,
      },
    });
    console.log(`- ${item.anchor_id} (${item.family}) ${item.title}`);
  }

  const total = await prisma.anchorItem.count();
  console.log(`\n=== 完了。anchor_items: ${total} 行 ===`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
