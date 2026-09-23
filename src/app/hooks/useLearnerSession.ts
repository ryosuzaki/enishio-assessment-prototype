"use client";

import { useCallback, useState } from "react";
import { messageOf } from "@/lib/error-message";

const DEMO_TENANT_NAMESPACE = "tenant-jaist-demo";
const DEMO_USER_ID = "examiner-preview-user";

/**
 * セッションの開始と識別子の保持。
 *
 * **開始したセッションIDは呼び出し側へ戻り値で返す。**直後の API 呼び出しで state を
 * 読むと、まだ反映されていない古い値を送ってしまう。
 */
export function useLearnerSession(setErrorMessage: (msg: string | null) => void) {
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionSeq, setSessionSeq] = useState<number>(1);
  const [learnerId, setLearnerId] = useState<string>("");

  /**
   * セッションを確保する。
   *
   * @param force true なら既存のセッションがあっても新しく開始する。
   * @returns 使うべき session_id。開始に失敗したら null。
   */
  const ensureSession = useCallback(
    async (force = false): Promise<string | null> => {
      if (!force && sessionId) return sessionId;

      try {
        const res = await fetch("/api/session/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tenantNamespace: DEMO_TENANT_NAMESPACE,
            userId: DEMO_USER_ID,
          }),
        });
        const data = await res.json();
        if (!data.success) {
          setErrorMessage(data.error ?? "セッションを開始できませんでした。");
          return null;
        }
        setSessionId(data.sessionId);
        setSessionSeq(data.sessionSeq);
        setLearnerId(data.learnerId);
        return data.sessionId as string;
      } catch (e: unknown) {
        setErrorMessage("セッション開始エラー: " + messageOf(e));
        return null;
      }
    },
    [sessionId, setErrorMessage]
  );

  return { sessionId, sessionSeq, learnerId, ensureSession };
}
