"use client";

import { useState } from "react";
import { messageOf } from "@/lib/error-message";
import { getDynamicTask } from "@/data/dynamic-task";
import { getDefaultMirroringSummary } from "../components/PreliminaryJudgementStep";
import { MAX_PROBES_PER_SESSION } from "../types";
import type {
  ChatMessage,
  EvaluationResult,
  EvidenceTargetState,
  FocusItem,
  PremiseShiftState,
  ProbeMove,
  StepType,
} from "../types";

interface DialogueFlowDeps {
  selectedTaskId: string;
  ensureSession: (force?: boolean) => Promise<string | null>;
  addTelemetry: (msg: string) => void;
  setErrorMessage: (msg: string | null) => void;
}

/**
 * 実務演習セッション（2ペイン動的対話 → CFF → 構造化採点パイプライン → XAIレポート）の進行。
 *
 * セッションIDは `ensureSession()` の戻り値を使う。開始直後に state を読むと、
 * まだ反映されていない空文字を API へ送ってしまう。
 */
export function useDialogueFlow({
  selectedTaskId,
  ensureSession,
  addTelemetry,
  setErrorMessage,
}: DialogueFlowDeps) {
  const selectedTask = getDynamicTask(selectedTaskId);

  const [currentStep, setCurrentStep] = useState<StepType>("init");
  const [sessionIdInUse, setSessionIdInUse] = useState<string>("");

  // Dynamic Session State (W3)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userPromptInput, setUserPromptInput] = useState<string>("");
  const [artifactCode, setArtifactCode] = useState<string>(selectedTask.initial_ai_draft);
  const [turnCounter, setTurnCounter] = useState<number>(1);
  const [cffActiveWarning, setCffActiveWarning] = useState<string | null>(null);
  // 前提変化（場面3: 緊急仕様変更・追加要件）の注入状態
  const [premiseShiftState, setPremiseShiftState] = useState<PremiseShiftState>({
    isInjected: false,
  });

  // Mediation State (MVP 2.1 ステップ7・8: ソクラテス型深掘り・What-if注入)
  const [mediationStateEstimate, setMediationStateEstimate] = useState<
    EvidenceTargetState[] | null
  >(null);
  const [lastProbeMove, setLastProbeMove] = useState<ProbeMove | null>(null);
  const [lastSelectionRationale, setLastSelectionRationale] = useState<string | null>(null);
  const [probesIssued, setProbesIssued] = useState<number>(0);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Verification Focus Panel State (W3 3rd-Pane) [MVP 4.4, T-17b]
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [focusInputText, setFocusInputText] = useState<string>("");
  const [focusInputNote, setFocusInputNote] = useState<string>("");

  // CFF: Force Decision First & Mandatory Justification State [MVP 2.5, T-17b, D-80]
  const [prelimAction, setPrelimAction] = useState<"approve" | "remand" | "comment" | "">("");
  const [prelimJustification, setPrelimJustification] = useState<string>("");
  const [prelimError, setPrelimError] = useState<string | null>(null);

  // Evaluation & XAI State (W4, W5)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [disputeDirection, setDisputeDirection] = useState<string>("");
  const [disputeSubmitted, setDisputeSubmitted] = useState<boolean>(false);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const resetSessionState = () => {
    setArtifactCode(selectedTask.initial_ai_draft);
    setChatHistory([
      {
        turnSeq: 1,
        role: "assistant",
        content: `${selectedTask.title}に関する成果物を作成しました。右側のコードを確認いただき、本番リリースに向けたレビューをお願いします！`,
      },
    ]);
    setTurnCounter(2);
    setMediationStateEstimate(null);
    setLastProbeMove(null);
    setLastSelectionRationale(null);
    setProbesIssued(0);
    setPremiseShiftState({ isInjected: false });
  };

  const startSession = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const newSessionId = await ensureSession(true);
      if (!newSessionId) return;
      setSessionIdInUse(newSessionId);
      addTelemetry(`Session initialized (ID: ${newSessionId.slice(0, 8)}...)`);

      // 仕込み不備と「正常箇所」のラベルをこのセッションに対して確定させる [P-15]
      const diagRes = await fetch("/api/dialogue/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: newSessionId, taskId: selectedTaskId }),
      });
      const diagData = await diagRes.json();
      if (!diagData.success) {
        setErrorMessage("課題開始エラー: " + diagData.error);
        return;
      }
      addTelemetry(
        `injected_flaw_map recorded (不備 ${diagData.flawCount} 件 + 正常箇所 ${diagData.normalSpanCount} 件)`
      );

      setCurrentStep("dialogue_session");
      resetSessionState();
      addTelemetry(`Dynamic Task initiated (${selectedTask.task_id})`);
    } catch (e: unknown) {
      setErrorMessage("セッション開始エラー: " + messageOf(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 前提変化（場面3: 緊急仕様変更・追加要件）の注入。
   *
   * **受講者は撃たない。**発火するかどうかはサーバ側が対話ログだけを見て決定論的に判定する
   * `[D-100]`。ここから渡せるのは「どのセッションの何ターン目か」だけで、
   * クライアントは注入するか否かを決められない。
   *
   * `force` は開発ビルド限定の手動発火（E2E・デバッグ用）。本番ビルドではサーバ側が無視する。
   */
  const maybeInjectPremiseShift = async (
    turnSeq: number,
    historySoFar: ChatMessage[],
    options?: { force?: boolean }
  ): Promise<boolean> => {
    if (premiseShiftState.isInjected) return false;
    try {
      const res = await fetch("/api/dialogue/premise-shift", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdInUse,
          taskId: selectedTaskId,
          turnSeq,
          ...(options?.force ? { force: true } : {}),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        // 前提変化が撃てなくても対話セッション自体は継続させる。ここで止めない。
        addTelemetry(`Premise shift check failed: ${data.error}`);
        return false;
      }
      if (!data.injected) return false;

      setPremiseShiftState({
        isInjected: true,
        injectedAtTurn: data.injectedAtTurn,
        title: data.title,
        announcement: data.announcement,
        newRequirement: data.newRequirement,
      });
      setChatHistory([
        ...historySoFar,
        { turnSeq: data.injectedAtTurn, role: "assistant", content: data.notification },
      ]);
      setTurnCounter(data.injectedAtTurn + 1);
      addTelemetry(
        `⚡ 前提変化を注入${data.forced ? "（手動 / dev）" : "（進行役判定）"}: Turn #${data.injectedAtTurn} / ${data.title}`
      );
      return true;
    } catch (e: unknown) {
      addTelemetry(`Premise shift request failed: ${messageOf(e)}`);
      return false;
    }
  };

  /** 開発ビルド限定の手動発火。受講者UIからは呼ばれない（DialogueSessionStep 側で隠す）。 */
  const forcePremiseShiftForDebug = () =>
    maybeInjectPremiseShift(turnCounter, chatHistory, { force: true });

  /**
   * ソクラテス型深掘り（MVP 2.1 ステップ7・8）。
   *
   * AI同僚の応答とは別の手番。**正答鍵（injected_flaw_map）はこの呼び出しに含めない**
   * ——渡っているのは taskId のみで、サーバ側で業務要件・制約と対話ログから
   * 状態推定を行う（`src/lib/mediator` の注記を参照）。
   */
  const runMediationProbe = async (turnSeq: number, historySoFar: ChatMessage[]) => {
    setIsProbing(true);
    try {
      const res = await fetch("/api/dialogue/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sessionIdInUse, taskId: selectedTaskId, turnSeq }),
      });
      const data = await res.json();
      if (!data.success) {
        // 深掘りが打てなくても対話セッション自体は継続させる。ここで止めない。
        if (!data.mediationUnavailable) {
          addTelemetry(`Mediation probe error: ${data.error}`);
        }
        return;
      }

      setMediationStateEstimate(data.stateEstimate ?? null);
      setLastProbeMove(data.probeMove ?? null);
      setLastSelectionRationale(data.selectionRationale ?? null);

      if (data.probeIssued) {
        setProbesIssued((n) => n + 1);
        setTurnCounter(turnSeq + 1);
        setChatHistory([...historySoFar, { turnSeq, role: "mediator", content: data.probeText }]);
        addTelemetry(`Mediation probe issued (${data.probeMove}, Turn #${turnSeq})`);
      } else {
        addTelemetry(`Mediation: no probe needed (${data.reason ?? data.probeMove})`);
      }
    } catch (e: unknown) {
      addTelemetry(`Mediation probe request failed: ${messageOf(e)}`);
    } finally {
      setIsProbing(false);
    }
  };

  const sendDialogueTurn = async () => {
    if (!userPromptInput.trim()) return;

    const currentTurn = turnCounter;
    const userText = userPromptInput;
    setUserPromptInput("");
    setCffActiveWarning(null);
    setErrorMessage(null);

    // Optimistically update chat
    const updatedHistory: ChatMessage[] = [
      ...chatHistory,
      { turnSeq: currentTurn, role: "user", content: userText },
    ];
    setChatHistory(updatedHistory);
    addTelemetry(`Prompt turn #${currentTurn} sent (Length: ${userText.length} chars)`);

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/dialogue/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdInUse,
          taskId: selectedTaskId,
          turnSeq: currentTurn,
          userMessage: userText,
          currentArtifactText: artifactCode,
          // 編集距離は送らない。観測変数をクライアントが自己申告しては測定にならないため、
          // サーバが保存済みの直前テキストと突き合わせて算出する（MVP 4.4）。
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage("対話エラー: " + data.error);
        setChatHistory(chatHistory);
        setUserPromptInput(userText);
        return;
      }

      const nextTurn = data.assistantTurnSeq + 1;
      const historyWithAssistant: ChatMessage[] = [
        ...updatedHistory,
        {
          turnSeq: data.assistantTurnSeq,
          role: "assistant",
          content: data.assistantMessage,
        },
      ];
      setChatHistory(historyWithAssistant);

      if (data.isInterlockTriggered) {
        setCffActiveWarning(data.assistantMessage);
        addTelemetry("Interlock triggered (Intent-Action Gap)");
      } else {
        addTelemetry(`AI Peer response recorded (Turn #${data.assistantTurnSeq})`);
      }

      if (data.updatedArtifact) {
        setArtifactCode(data.updatedArtifact);
        addTelemetry("Artifact draft updated by AI Peer");
      }

      setTurnCounter(nextTurn);

      // 意図-行動ギャップのインターロック（正規表現ベース。別機構）が発火したターンには
      // 前提変化も深掘りも重ねない。受講者が中身のある発話をしていない手番である。
      if (!data.isInterlockTriggered) {
        // 前提変化と深掘りは同じ手番に並べない。深掘りの状態推定は注入前のログに
        // 基づいており、前提が変わった直後に投げても噛み合わない。
        const shiftInjected = await maybeInjectPremiseShift(nextTurn, historyWithAssistant);

        // 上限に達していれば深掘りは呼ばない。
        if (!shiftInjected && probesIssued < MAX_PROBES_PER_SESSION) {
          await runMediationProbe(nextTurn, historyWithAssistant);
        }
      }
    } catch (e: unknown) {
      setErrorMessage("対話送信エラー: " + messageOf(e));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verification Focus Panel Handlers [MVP 4.4, T-17b]
  const addFocusItem = (textSnippet?: string, noteText?: string) => {
    const text = (textSnippet ?? focusInputText).trim();
    if (!text) return;
    const nextSeq = focusItems.length + 1;
    setFocusItems((prev) => [
      ...prev,
      {
        focusSeq: nextSeq,
        selectedText: text,
        note: (noteText ?? focusInputNote).trim() || undefined,
      },
    ]);
    setFocusInputText("");
    setFocusInputNote("");
    addTelemetry(`Verification focus item #${nextSeq} added to panel`);
  };

  const removeFocusItem = (seq: number) => {
    setFocusItems((prev) =>
      prev
        .filter((item) => item.focusSeq !== seq)
        .map((item, idx) => ({ ...item, focusSeq: idx + 1 }))
    );
    addTelemetry(`Verification focus item #${seq} removed from panel`);
  };

  // Advance to CFF: Force Decision First & Mandatory Justification Step [MVP 2.5, T-17b]
  const proceedToPreliminaryJudgement = () => {
    setErrorMessage(null);
    if (chatHistory.length < 2) {
      setErrorMessage("最低1回以上AI同僚と対話してから完了してください。");
      return;
    }
    setPrelimError(null);
    setCurrentStep("preliminary_judgement");
    addTelemetry(
      "Review completed. Advancing to Force Decision First (CFF) - Preliminary Judgement"
    );
  };

  const confirmPreliminaryAndEvaluate = async () => {
    if (!prelimAction) {
      setPrelimError("成果物の判定（承認または差し戻し）を選択してください。");
      return;
    }

    // [D-80]: 白紙再作文の強制撤廃。受講者が微調整を入力しなかった場合は
    // 進行役のミラーリング要約を採用する
    const effectiveJustification =
      prelimJustification.trim() || getDefaultMirroringSummary(selectedTaskId, chatHistory);

    setPrelimError(null);
    setErrorMessage(null);
    setIsEvaluating(true);
    addTelemetry("Submitting Preliminary Judgement & Justification (PR-review style)...");

    try {
      // 1. Record preliminary judgement (CFF)
      const prelimRes = await fetch("/api/dialogue/preliminary-judgement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdInUse,
          stepId: `step-dynamic-${selectedTaskId}`,
          action: prelimAction,
          justification: effectiveJustification,
        }),
      });
      const prelimData = await prelimRes.json();
      if (!prelimData.success) {
        setErrorMessage("暫定判断記録エラー: " + prelimData.error);
        setIsEvaluating(false);
        return;
      }
      addTelemetry(`Preliminary judgement recorded: ${prelimAction}`);

      // 2. Record verification focus sequence if any items selected
      if (focusItems.length > 0) {
        await fetch("/api/dialogue/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: sessionIdInUse,
            focusItems: focusItems.map((f) => ({
              focusSeq: f.focusSeq,
              selectedText: f.selectedText,
              note: f.note,
            })),
          }),
        });
        addTelemetry(`Verification focus sequence recorded (${focusItems.length} items)`);
      }

      // 3. Trigger 2-Stage Structured Scoring Pipeline (W4)
      addTelemetry("Triggering 構造化採点パイプライン (Axis 4)...");
      const evalRes = await fetch("/api/dialogue/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionIdInUse,
          taskId: selectedTaskId,
          transcript: chatHistory,
          finalArtifact: artifactCode,
        }),
      });

      const data = await evalRes.json();
      if (data.success) {
        setEvaluation(data);
        setCurrentStep("evaluation_report");
        addTelemetry(
          data.isPendingHumanReview
            ? `Evaluation pending human review (confidence ${data.scoringConfidence.toFixed(2)} < ${data.confidenceThreshold.toFixed(2)}${data.isDemoThresholdOverride ? ", demo override" : ""})`
            : `Evaluation complete: ${data.levelLabel} (Rating ID: ${data.ratingId.slice(0, 8)}...)`
        );
      } else if (data.scoringUnavailable) {
        // 採点できないときに推測値で埋めない。埋めると ratings に偽の評点が残る。
        setErrorMessage(
          `採点を実行できませんでした（${data.stage === "extract" ? "第1段階" : "第2段階"}）。\n\n` +
            data.error
        );
      } else {
        setErrorMessage("評価エラー: " + data.error);
      }
    } catch (e: unknown) {
      setErrorMessage("評価リクエスト失敗: " + messageOf(e));
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit Score Dispute (MVP 4.5 / W5)
  const submitDispute = async () => {
    if (!disputeReason.trim() || !disputeDirection || !evaluation) return;

    setErrorMessage(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratingId: evaluation.ratingId,
          sessionId: sessionIdInUse,
          disagreementDirection: disputeDirection,
          freeTextReason: disputeReason,
          scorerModelVersion: evaluation.scorerModelVersion,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setErrorMessage("異議申立エラー: " + data.error);
        return;
      }
      setDisputeSubmitted(true);
      addTelemetry(`Score dispute recorded in score_feedback (ID: ${data.feedbackId.slice(0, 8)}...)`);
    } catch (e: unknown) {
      setErrorMessage("異議申立エラー: " + messageOf(e));
    }
  };

  return {
    selectedTask,
    currentStep,
    setCurrentStep,
    chatHistory,
    userPromptInput,
    setUserPromptInput,
    artifactCode,
    setArtifactCode,
    turnCounter,
    cffActiveWarning,
    premiseShiftState,
    mediationStateEstimate,
    lastProbeMove,
    lastSelectionRationale,
    probesIssued,
    isProbing,
    focusItems,
    focusInputText,
    setFocusInputText,
    prelimAction,
    setPrelimAction,
    prelimJustification,
    setPrelimJustification,
    prelimError,
    evaluation,
    isEvaluating,
    disputeReason,
    setDisputeReason,
    disputeDirection,
    setDisputeDirection,
    disputeSubmitted,
    isSubmitting,
    startSession,
    forcePremiseShiftForDebug,
    sendDialogueTurn,
    addFocusItem,
    removeFocusItem,
    proceedToPreliminaryJudgement,
    confirmPreliminaryAndEvaluate,
    submitDispute,
  };
}
