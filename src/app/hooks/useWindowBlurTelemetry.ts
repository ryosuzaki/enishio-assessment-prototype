"use client";

import { useEffect, useRef } from "react";

/**
 * 画面外滞在時間の記録（MVP 4.4 `window_blur_duration_sec`）。
 *
 * **判定には一切用いない。**Phase 3 の多層防衛の資産として貯めるだけであり、
 * このプロトタイプの採点・保留判定・レポート表示のどこからも参照しない。
 *
 * 購読は1度きりにする。`sessionId` を依存配列へ入れると、セッション開始のたびに
 * 購読を張り直して**離脱中の計測が切れる。**代わりに ref で最新値を読む。
 */
export function useWindowBlurTelemetry(sessionId: string) {
  const sessionIdRef = useRef(sessionId);

  // 同期はレンダー中ではなく effect で行う。レンダー中の ref 書き込みは
  // 並行レンダリングで破棄される描画からも走りうる。
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  useEffect(() => {
    let hiddenSince: number | null = null;

    const flush = () => {
      if (hiddenSince === null) return;
      const deltaSec = (Date.now() - hiddenSince) / 1000;
      hiddenSince = null;
      const currentSessionId = sessionIdRef.current;
      if (!currentSessionId || deltaSec < 1) return;
      fetch("/api/session/blur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: currentSessionId, deltaSec }),
      }).catch(() => {
        // 記録専用の副次的テレメトリである。失敗してもセッションは続行する。
      });
    };

    const onHide = () => {
      if (hiddenSince === null) hiddenSince = Date.now();
    };
    const onShow = () => flush();

    const onVisibilityChange = () => (document.hidden ? onHide() : onShow());

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onHide);
    window.addEventListener("focus", onShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onHide);
      window.removeEventListener("focus", onShow);
      flush();
    };
  }, []);
}
