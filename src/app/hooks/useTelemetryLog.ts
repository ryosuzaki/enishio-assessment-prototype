"use client";

import { useCallback, useState } from "react";

/**
 * 画面上のテレメトリ表示とエラー表示。
 *
 * 各フローが共通で書き込む先なので、状態の持ち主をここ1箇所にする。
 * `addTelemetry` は他のフックの依存配列へ入るため、参照が毎回変わらないようにする。
 */
export function useTelemetryLog() {
  const [telemetryLog, setTelemetryLog] = useState<string[]>([]);
  // 画面内エラー表示。window.alert() は使わない（ErrorBanner の注記を参照）
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addTelemetry = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTelemetryLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 24)]);
  }, []);

  return { telemetryLog, addTelemetry, errorMessage, setErrorMessage };
}
