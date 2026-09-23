import Link from "next/link";
import { Card } from "./components/ui";

/**
 * Next.js App Router 404 Not Found ページ。
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1536px] px-6 py-section">
      <Card className="space-y-block border-line p-block">
        <div className="space-y-row">
          <span className="text-section font-semibold text-ink">
            ページが見つかりません (404 Not Found)
          </span>
          <p className="text-body text-ink-2">
            指定されたURLのページは存在しないか、移動した可能性があります。
          </p>
        </div>

        <div className="pt-row">
          <Link
            href="/"
            className="inline-flex h-9 items-center justify-center rounded-chip border border-line bg-surface px-4 text-label font-medium text-ink transition-colors hover:bg-surface-page"
          >
            初期画面へ戻る
          </Link>
        </div>
      </Card>
    </div>
  );
}
