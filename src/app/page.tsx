"use client";

import React, { useState, useEffect } from "react";
import { DYNAMIC_TASKS, getDynamicTask } from "@/data/dynamic-task";
import { levenshtein } from "@/lib/edit-distance";
import type {
  AnchorItem,
  ChatMessage,
  FocusItem,
  EvaluationResult,
  StepType,
} from "./types";
import { InitStep } from "./components/InitStep";
import { AnchorQuestionStep } from "./components/AnchorQuestionStep";
import { DialogueSessionStep } from "./components/DialogueSessionStep";
import { PreliminaryJudgementStep } from "./components/PreliminaryJudgementStep";
import { EvaluationReportStep } from "./components/EvaluationReportStep";
import { TelemetryPanel } from "./components/TelemetryPanel";

export default function AssessmentPrototypePage() {
  // Session & Phase State
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionSeq, setSessionSeq] = useState<number>(1);
  const [learnerId, setLearnerId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<StepType>("init");

  // Anchor State (W2)
  const [anchorList, setAnchorList] = useState<{ anchor_id: string; title: string; family: string }[]>([]);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>("ANCHOR-A-01");
  const [currentAnchor, setCurrentAnchor] = useState<AnchorItem | null>(null);
  const [q1Choice, setQ1Choice] = useState<string>("");
  const [q2Choice, setQ2Choice] = useState<string>("");
  const [confidence, setConfidence] = useState<number>(3);
  const [q1StartTime, setQ1StartTime] = useState<number>(0);
  const [q2StartTime, setQ2StartTime] = useState<number>(0);
  const [q1DurationMs, setQ1DurationMs] = useState<number>(0);
  const [q2DurationMs, setQ2DurationMs] = useState<number>(0);

  // Dynamic Task Selection (T-06a) — 取り組む動的課題をレジストリから選択する
  const [selectedTaskId, setSelectedTaskId] = useState<string>(DYNAMIC_TASKS[0].task_id);
  const selectedTask = getDynamicTask(selectedTaskId);

  // Dynamic Session State (W3)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userPromptInput, setUserPromptInput] = useState<string>("");
  const [artifactCode, setArtifactCode] = useState<string>(DYNAMIC_TASKS[0].initial_ai_draft);
  const [turnCounter, setTurnCounter] = useState<number>(1);
  const [cffActiveWarning, setCffActiveWarning] = useState<string | null>(null);
  // 直近に記録した成果物。次ターンの編集距離をこれとの差分で測る（MVP 4.4）
  const [lastLoggedArtifact, setLastLoggedArtifact] = useState<string>(DYNAMIC_TASKS[0].initial_ai_draft);

  // Verification Focus Panel State (W3 3rd-Pane) [MVP 4.4, T-17b]
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [focusInputText, setFocusInputText] = useState<string>("");
  const [focusInputNote, setFocusInputNote] = useState<string>("");

  // CFF: Force Decision First & Mandatory Justification State [MVP 2.5, T-17b]
  const [prelimAction, setPrelimAction] = useState<"approve" | "remand" | "">("");
  const [prelimScore, setPrelimScore] = useState<number>(3);
  const [prelimJustification, setPrelimJustification] = useState<string>("");
  const [prelimError, setPrelimError] = useState<string | null>(null);

  // Evaluation & XAI State (W4, W5)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [isEvaluating, setIsEvaluating] = useState<boolean>(false);
  const [disputeReason, setDisputeReason] = useState<string>("");
  const [disputeDirection, setDisputeDirection] = useState<string>("");
  const [disputeSubmitted, setDisputeSubmitted] = useState<boolean>(false);

  // Telemetry Monitor
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [telemetryLog, setTelemetryLog] = useState<string[]>([]);

  // Load anchor list on mount
  useEffect(() => {
    fetch("/api/anchor")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.anchors) {
          setAnchorList(data.anchors);
        }
      })
      .catch((e) => console.error("Fetch anchors error:", e));
  }, []);

  const addTelemetry = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTelemetryLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Start Session
  const handleStartSession = async () => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/session/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantNamespace: "tenant-jaist-demo",
          userId: "examiner-preview-user",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSessionId(data.sessionId);
        setSessionSeq(data.sessionSeq);
        setLearnerId(data.learnerId);
        addTelemetry(`Session initialized (Seq #${data.sessionSeq}, ID: ${data.sessionId.slice(0, 8)}...)`);

        // Load chosen anchor item
        const anchorRes = await fetch(`/api/anchor?id=${selectedAnchorId}`);
        const anchorData = await anchorRes.json();
        if (anchorData.success) {
          setCurrentAnchor(anchorData.anchor);
          setCurrentStep("anchor_q1");
          setQ1StartTime(Date.now());
          addTelemetry(`Anchor stimulus loaded (${selectedAnchorId}) - pretest mode`);
        }
      }
    } catch (e: any) {
      alert("セッション開始エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Anchor Flow Step Handlers
  const handleQ1Next = () => {
    if (!q1Choice) return;
    const duration = Date.now() - q1StartTime;
    setQ1DurationMs(duration);
    setCurrentStep("anchor_q2");
    setQ2StartTime(Date.now());
    addTelemetry(`Q1 Answer recorded (${q1Choice}) in ${(duration / 1000).toFixed(1)}s`);
  };

  const handleQ2Next = () => {
    if (!q2Choice) return;
    const duration = Date.now() - q2StartTime;
    setQ2DurationMs(duration);
    setCurrentStep("anchor_conf");
    addTelemetry(`Q2 Answer recorded (${q2Choice}) in ${(duration / 1000).toFixed(1)}s`);
  };

  const handleAnchorSubmit = async () => {
    if (!currentAnchor) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          anchorId: currentAnchor.anchor_id,
          q1Selection: q1Choice,
          q2Selection: q2Choice,
          confidence,
          q1DurationMs,
          q2DurationMs,
        }),
      });
      const data = await res.json();
      if (data.success) {
        addTelemetry(
          `Anchor recorded (Response ID: ${data.responseId.slice(0, 8)}..., ${data.anchorStatus} / 無得点)`
        );
        setCurrentStep("anchor_complete");
      } else {
        alert("アンカー記録エラー: " + data.error);
      }
    } catch (e: any) {
      alert("送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transition to Dynamic Dialogue Session (W3)
  const handleStartDialogueSession = async () => {
    // 仕込み不備と「正常箇所」のラベルをこのセッションに対して確定させる [P-15]
    try {
      const res = await fetch("/api/dialogue/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, taskId: selectedTaskId }),
      });
      const data = await res.json();
      if (data.success) {
        addTelemetry(
          `injected_flaw_map recorded (不備 ${data.flawCount} 件 + 正常箇所 ${data.normalSpanCount} 件)`
        );
      } else {
        alert("課題開始エラー: " + data.error);
        return;
      }
    } catch (e: any) {
      alert("課題開始エラー: " + e.message);
      return;
    }

    setCurrentStep("dialogue_session");
    setArtifactCode(selectedTask.initial_ai_draft);
    setChatHistory([
      {
        turnSeq: 1,
        role: "assistant",
        content: `${selectedTask.title}に関する成果物を作成しました。右側のコードを確認いただき、本番リリースに向けたレビューをお願いします！`,
      },
    ]);
    setTurnCounter(2);
    setLastLoggedArtifact(selectedTask.initial_ai_draft);
    addTelemetry(`Dynamic Task initiated (${selectedTask.task_id})`);
  };

  // Send User Prompt in Dialogue Session (W3)
  const handleSendDialogueTurn = async () => {
    if (!userPromptInput.trim()) return;

    const currentTurn = turnCounter;
    const userText = userPromptInput;
    setUserPromptInput("");
    setCffActiveWarning(null);

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
          sessionId,
          taskId: selectedTaskId,
          turnSeq: currentTurn,
          userMessage: userText,
          currentArtifactText: artifactCode,
          // 前回記録時点からの実測 Levenshtein 距離（MVP 4.4）
          editDistance: levenshtein(lastLoggedArtifact, artifactCode),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("対話エラー: " + data.error);
        setChatHistory(chatHistory);
        setUserPromptInput(userText);
        return;
      }
      setLastLoggedArtifact(artifactCode);
      if (data.success) {
        const nextTurn = data.assistantTurnSeq + 1;
        setTurnCounter(nextTurn);

        setChatHistory([
          ...updatedHistory,
          {
            turnSeq: data.assistantTurnSeq,
            role: "assistant",
            content: data.assistantMessage,
          },
        ]);

        if (data.isInterlockTriggered) {
          setCffActiveWarning(data.assistantMessage);
          addTelemetry(`Interlock triggered (Intent-Action Gap)`);
        } else {
          addTelemetry(`AI Peer response recorded (Turn #${data.assistantTurnSeq})`);
        }

        if (data.updatedArtifact) {
          setArtifactCode(data.updatedArtifact);
          addTelemetry(`Artifact draft updated by AI Peer`);
        }
      }
    } catch (e: any) {
      alert("対話送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Verification Focus Panel Handlers [MVP 4.4, T-17b]
  const handleAddFocusItem = (textSnippet?: string, noteText?: string) => {
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

  const handleRemoveFocusItem = (seq: number) => {
    setFocusItems((prev) =>
      prev
        .filter((item) => item.focusSeq !== seq)
        .map((item, idx) => ({ ...item, focusSeq: idx + 1 }))
    );
    addTelemetry(`Verification focus item #${seq} removed from panel`);
  };

  // Advance to CFF: Force Decision First & Mandatory Justification Step [MVP 2.5, T-17b]
  const handleProceedToPreliminaryJudgement = () => {
    if (chatHistory.length < 2) {
      alert("最低1回以上AI同僚と対話してから完了してください。");
      return;
    }
    setPrelimError(null);
    setCurrentStep("preliminary_judgement");
    addTelemetry(
      "Review completed. Advancing to Force Decision First (CFF) - Preliminary Judgement"
    );
  };

  // Confirm Preliminary Judgement & Execute AutoSCORE Evaluation (W4)
  const handleConfirmPreliminaryAndEvaluate = async () => {
    if (!prelimAction) {
      setPrelimError("成果物の判定（承認または差し戻し）を選択してください。");
      return;
    }
    if (!prelimJustification.trim()) {
      setPrelimError("判断理由の記述は必須です（Mandatory Justification・空文字不可）。");
      return;
    }

    setPrelimError(null);
    setIsEvaluating(true);
    addTelemetry("Submitting Preliminary Judgement & Mandatory Justification...");

    try {
      // 1. Record preliminary judgement (CFF)
      const prelimRes = await fetch("/api/dialogue/preliminary-judgement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          stepId: `step-dynamic-${selectedTaskId}`,
          action: prelimAction,
          selfEstimatedScore: prelimScore,
          justification: prelimJustification.trim(),
        }),
      });
      const prelimData = await prelimRes.json();
      if (!prelimData.success) {
        alert("暫定判断記録エラー: " + prelimData.error);
        setIsEvaluating(false);
        return;
      }
      addTelemetry(
        `Preliminary judgement recorded: ${prelimAction} (Self Band: ${prelimScore})`
      );

      // 2. Record verification focus sequence if any items selected
      if (focusItems.length > 0) {
        await fetch("/api/dialogue/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            focusItems: focusItems.map((f) => ({
              focusSeq: f.focusSeq,
              selectedText: f.selectedText,
              note: f.note,
            })),
          }),
        });
        addTelemetry(`Verification focus sequence recorded (${focusItems.length} items)`);
      }

      // 3. Trigger 2-Stage AutoSCORE Evaluation (W4)
      addTelemetry(`Triggering AutoSCORE 2-Stage Evaluator (Axis 4)...`);
      const evalRes = await fetch("/api/dialogue/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
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
            ? `Evaluation pending human review (confidence ${data.scoringConfidence.toFixed(2)} < 0.70)`
            : `Evaluation complete: ${data.levelLabel} (Rating ID: ${data.ratingId.slice(0, 8)}...)`
        );
      } else if (data.scoringUnavailable) {
        // 採点できないときに推測値で埋めない。埋めると ratings に偽の評点が残る。
        alert(
          `採点を実行できませんでした（${data.stage === "extract" ? "第1段階" : "第2段階"}）。\n\n` +
            data.error
        );
      } else {
        alert("評価エラー: " + data.error);
      }
    } catch (e: any) {
      alert("評価リクエスト失敗: " + e.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit Score Dispute (MVP 4.5 / W5)
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim() || !disputeDirection || !evaluation) return;

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ratingId: evaluation.ratingId,
          sessionId,
          disagreementDirection: disputeDirection,
          freeTextReason: disputeReason,
          scorerModelVersion: evaluation.scorerModelVersion,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert("異議申立エラー: " + data.error);
        return;
      }
      if (data.success) {
        setDisputeSubmitted(true);
        addTelemetry(`Score dispute recorded in score_feedback (ID: ${data.feedbackId.slice(0, 8)}...)`);
      }
    } catch (e: any) {
      alert("異議申立エラー: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 0: Initialization */}
          {currentStep === "init" && (
            <InitStep
              selectedAnchorId={selectedAnchorId}
              setSelectedAnchorId={setSelectedAnchorId}
              anchorList={anchorList}
              selectedTaskId={selectedTaskId}
              setSelectedTaskId={setSelectedTaskId}
              selectedTask={selectedTask}
              isSubmitting={isSubmitting}
              onStartSession={handleStartSession}
            />
          )}

          {/* STEP 1〜4: Anchor Flow (Q1, Q2, Confidence, Complete) */}
          {(currentStep === "anchor_q1" ||
            currentStep === "anchor_q2" ||
            currentStep === "anchor_conf" ||
            currentStep === "anchor_complete") && (
            <AnchorQuestionStep
              currentStep={currentStep}
              currentAnchor={currentAnchor}
              q1Choice={q1Choice}
              setQ1Choice={setQ1Choice}
              q2Choice={q2Choice}
              setQ2Choice={setQ2Choice}
              confidence={confidence}
              setConfidence={setConfidence}
              isSubmitting={isSubmitting}
              onQ1Next={handleQ1Next}
              onQ2Next={handleQ2Next}
              onAnchorSubmit={handleAnchorSubmit}
              onStartDialogueSession={handleStartDialogueSession}
            />
          )}

          {/* STEP 5: Dynamic 3-Pane Dialogue Session (W3) */}
          {currentStep === "dialogue_session" && (
            <DialogueSessionStep
              selectedTask={selectedTask}
              artifactCode={artifactCode}
              setArtifactCode={setArtifactCode}
              focusItems={focusItems}
              focusInputText={focusInputText}
              setFocusInputText={setFocusInputText}
              chatHistory={chatHistory}
              turnCounter={turnCounter}
              userPromptInput={userPromptInput}
              setUserPromptInput={setUserPromptInput}
              cffActiveWarning={cffActiveWarning}
              isSubmitting={isSubmitting}
              onProceedToPreliminaryJudgement={handleProceedToPreliminaryJudgement}
              onAddFocusItem={handleAddFocusItem}
              onRemoveFocusItem={handleRemoveFocusItem}
              onSendDialogueTurn={handleSendDialogueTurn}
            />
          )}

          {/* STEP 5.5: CFF Force Decision First & Mandatory Justification [MVP 2.5, T-17b] */}
          {currentStep === "preliminary_judgement" && (
            <PreliminaryJudgementStep
              prelimAction={prelimAction}
              setPrelimAction={setPrelimAction}
              prelimScore={prelimScore}
              setPrelimScore={setPrelimScore}
              prelimJustification={prelimJustification}
              setPrelimJustification={setPrelimJustification}
              prelimError={prelimError}
              isEvaluating={isEvaluating}
              onBackToDialogue={() => setCurrentStep("dialogue_session")}
              onConfirmPreliminaryAndEvaluate={handleConfirmPreliminaryAndEvaluate}
            />
          )}

          {/* STEP 6: XAI Evaluation Report Screen (W5) */}
          {currentStep === "evaluation_report" && evaluation && (
            <EvaluationReportStep
              evaluation={evaluation}
              chatHistory={chatHistory}
              prelimAction={prelimAction}
              prelimScore={prelimScore}
              prelimJustification={prelimJustification}
              disputeReason={disputeReason}
              setDisputeReason={setDisputeReason}
              disputeDirection={disputeDirection}
              setDisputeDirection={setDisputeDirection}
              disputeSubmitted={disputeSubmitted}
              onSubmitDispute={handleSubmitDispute}
              onResetToInit={() => setCurrentStep("init")}
            />
          )}
        </div>

        {/* Right Column: Live Telemetry Monitor & System Architecture */}
        <div className="space-y-6">
          <TelemetryPanel
            learnerId={learnerId}
            sessionId={sessionId}
            sessionSeq={sessionSeq}
            telemetryLog={telemetryLog}
          />
        </div>
      </div>
    </div>
  );
}
