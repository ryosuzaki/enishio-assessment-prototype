"use client";

import React, { useEffect } from "react";
import { Button, Card } from "./components/ui";

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Next.js App Router ルートセグメント用 Error Boundary。
 *
 * 予期しないランタイム例外を捕捉し、ホワイトアウトを防いで
 * 復帰（reset）アクションを提示する。
 */
export default function RootError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error("ルートレベルで未処理のエラーを捕捉しました:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1536px] px-6 py-section">
      <Card className="space-y-block border-line p-block">
        <div className="space-y-row">
          <span className="text-section font-semibold text-ink">
            予期しないエラーが発生しました
          </span>
          <p className="text-body text-ink-2">
            画面の描画中に問題が発生しました。操作をやり直すか、初期画面へお戻りください。
          </p>
        </div>

        {error.digest && (
          <div className="text-caption text-ink-3">
            Error ID: <span className="font-mono">{error.digest}</span>
          </div>
        )}

        <div className="flex items-center gap-block pt-row">
          <Button variant="primary" onClick={() => reset()}>
            やり直す
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              // ルータ遷移ではなくフルリロードにする。ここへ来ている時点で
              // クライアント側の状態は壊れており、**捨てて作り直すことが目的である。**
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- 状態を捨てるための意図的なリロード
              if (typeof window !== "undefined") window.location.href = "/";
            }}
          >
            初期画面へ戻る
          </Button>
        </div>
      </Card>
    </div>
  );
}
