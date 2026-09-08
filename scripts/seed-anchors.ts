/**
 * アンカー項目バンクを anchor_items テーブルへ投入する。
 *
 * anchor_responses は anchor_items への外部キーを持つため、これを流していないと
 * アンカー出題フローは必ず外部キー違反で落ちる。
 *
 * 供給源は2つあり、`loadAnchorBank()` が運用バンク（`npm run parse:anchors` で生成）を
 * 優先し、無ければ同梱の公開デモ用サンプルへフォールバックする。**サンプルへ落ちた場合は
 * その旨を明示して投入する**（黙って2項目を入れて20項目のつもりにさせない）。
 *
 * 全項目を anchor_status = "pretest" として投入する [D-51]。
 * 昇格判定（pretest → operational）は本縦切りのスコープ外（禁止事項3）。
 */
// `.env` を読み込む。Next.js は自動で読むが、tsx で直接起動するスクリプトは読まない。
// これが無いと DATABASE_URL / APIキーを `.env` に書いても "Environment variable not found"
// で落ちる（README の手順どおりに進めた利用者がここで詰まる）。
import "dotenv/config";
import { prisma } from "../src/lib/db";
import {
  loadAnchorBank,
  isRetiredSource,
  RETIRED_BANK_WARNING,
  OPERATIONAL_BANK_PATH_V2,
  SAMPLE_BANK_PATH_V2,
} from "../src/lib/anchor-bank";

async function main() {
  const { anchors, source } = loadAnchorBank();

  if (source === "missing") {
    console.error(`アンカー項目バンクを読み込めませんでした。`);
    console.error(`  運用バンク: ${OPERATIONAL_BANK_PATH_V2}`);
    console.error(`  同梱サンプル: ${SAMPLE_BANK_PATH_V2}（リポジトリに含まれるはず）`);
    process.exit(1);
  }

  if (source === "demo_sample_v2") {
    console.log("=== 供給源: 公開デモ用サンプル（v2-sct・3項目） ===");
    console.log(`${OPERATIONAL_BANK_PATH_V2} が無いため ${SAMPLE_BANK_PATH_V2} を投入します。`);
    console.log("**これは運用アンカーバンクではありません。**\n");
  }

  if (isRetiredSource(source)) {
    console.log("=== ⚠️ 退役形式のバンクです ===");
    console.log(RETIRED_BANK_WARNING);
    console.log("投入は行いますが、この応答を較正・等化に用いてはなりません。\n");
  }

  console.log(`=== anchor_items の投入（${anchors.length}項目 / source=${source}） ===`);

  for (const item of anchors) {
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
