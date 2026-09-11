"use client";

import React, { useState, useEffect, useRef } from "react";
import { DYNAMIC_TASKS, getDynamicTask } from "@/data/dynamic-task";
import { levenshtein } from "@/lib/edit-distance";
import type {
  AnchorItem,
  ChatMessage,
  FocusItem,
  EvaluationResult,
  EvidenceTargetState,
  ProbeMove,
  StepType,
  AppTab,
} from "./types";
import { MAX_PROBES_PER_SESSION } from "./types";
import type { AnchorBankSourceView } from "./types";
import { Play, Building2, UserCheck } from "lucide-react";
import { InitStep } from "./components/InitStep";
import { AnchorQuestionStep } from "./components/AnchorQuestionStep";
import { DialogueSessionStep } from "./components/DialogueSessionStep";
import {
  PreliminaryJudgementStep,
  getDefaultMirroringSummary,
} from "./components/PreliminaryJudgementStep";
import { EvaluationReportStep } from "./components/EvaluationReportStep";
import { MediationStatePanel } from "./components/MediationStatePanel";
import { TelemetryPanel } from "./components/TelemetryPanel";
import { ErrorBanner } from "./components/ErrorBanner";
import { OrganizationDashboard } from "./components/OrganizationDashboard";
import { LearnerProfile } from "./components/LearnerProfile";

export default function AssessmentPrototypePage() {
  // Navigation & Tab State ([D-79]: 2-layer Viability & Feasibility)
  const [activeTab, setActiveTab] = useState<AppTab>("session");

  // Session & Phase State
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionSeq, setSessionSeq] = useState<number>(1);
  const [learnerId, setLearnerId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<StepType>("init");

  // Anchor State (W2)
  const [anchorList, setAnchorList] = useState<{ anchor_id: string; title: string; family: string }[]>([]);
  // 読み込めたバンクが運用20項目か同梱サンプル2項目かを画面に明示する。
  // 供給源が確定するまでは null（未取得）にしておき、断定的な表示をしない。
  const [bankSource, setBankSource] = useState<AnchorBankSourceView | null>(null);
  const [selectedAnchorId, setSelectedAnchorId] = useState<string>("");
  const [anchorStatus, setAnchorStatus] = useState<string>("pretest");
  const [currentAnchor, setCurrentAnchor] = useState<AnchorItem | null>(null);
  // 4段構成 [D-83]: 段階1 採用可否 → 段階2 懸念領域 → 段階3 前提変化への判断更新 → 確信度
  const [stage1Choice, setStage1Choice] = useState<string>("");
  const [stage2Choice, setStage2Choice] = useState<string>("");
  const [stage3Choice, setStage3Choice] = useState<number | null>(null);
  // 段階3': 新情報を含まない反論への再回答。項目によっては存在しない [D-83]
  const [stage3bChoice, setStage3bChoice] = useState<number | null>(null);
  const [confidence, setConfidence] = useState<number>(3);
  const [stageStartTime, setStageStartTime] = useState<number>(0);
  const [stage1DurationMs, setStage1DurationMs] = useState<number>(0);
  const [stage2DurationMs, setStage2DurationMs] = useState<number>(0);
  const [stage3DurationMs, setStage3DurationMs] = useState<number>(0);
  const [stage3bDurationMs, setStage3bDurationMs] = useState<number>(0);

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

  // Mediation State (MVP 2.1 ステップ7・8: ソクラテス型深掘り・What-if注入)
  const [mediationStateEstimate, setMediationStateEstimate] = useState<EvidenceTargetState[] | null>(null);
  const [lastProbeMove, setLastProbeMove] = useState<ProbeMove | null>(null);
  const [lastSelectionRationale, setLastSelectionRationale] = useState<string | null>(null);
  const [probesIssued, setProbesIssued] = useState<number>(0);
  const [isProbing, setIsProbing] = useState<boolean>(false);

  // Verification Focus Panel State (W3 3rd-Pane) [MVP 4.4, T-17b]
  const [focusItems, setFocusItems] = useState<FocusItem[]>([]);
  const [focusInputText, setFocusInputText] = useState<string>("");
  const [focusInputNote, setFocusInputNote] = useState<string>("");

  // CFF: Force Decision First & Mandatory Justification State [MVP 2.5, T-17b, D-80]
  const [prelimAction, setPrelimAction] = useState<"approve" | "remand" | "">("");
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
  // 画面内エラー表示。window.alert() は使わない（ErrorBanner の注記を参照）
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load anchor list on mount
  useEffect(() => {
    fetch("/api/anchor")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.anchors?.length) {
          setAnchorList(data.anchors);
          setBankSource(data.bankSource ?? null);
          // 既定の出題項目は先頭に合わせる。特定IDを決め打ちすると、
          // 運用バンクと同梱サンプルでID体系が違うため片方で必ず404になる。
          setSelectedAnchorId(data.anchors[0].anchor_id);
        } else {
          setErrorMessage(
            data.error ??
              "アンカー項目バンクを読み込めませんでした。'npm run seed:anchors' が済んでいるか確認してください。"
          );
        }
      })
      .catch((e) => setErrorMessage("アンカー項目の取得に失敗しました: " + e.message));
  }, []);

  // URLクエリによる初期タブの反映（?tab=dashboard / ?tab=learner / ?tab=session）
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      if (tab === "dashboard" || tab === "org") {
        setActiveTab("org_dashboard");
      } else if (tab === "profile" || tab === "learner") {
        setActiveTab("learner_profile");
      } else if (tab === "session") {
        setActiveTab("session");
      }
    }
  }, []);

  // 画面外滞在時間の記録（MVP 4.4 `window_blur_duration_sec`）。
  // **判定には一切用いない。**Phase 3の多層防衛の資産として貯めるだけであり、
  // このプロトタイプの採点・保留判定・レポート表示のどこからも参照しない。
  const sessionIdRef = useRef(sessionId);
  sessionIdRef.current = sessionId;
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

  const addTelemetry = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setTelemetryLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 24)]);
  };

  // Start Session
  const handleStartSession = async () => {
    if (!selectedAnchorId) {
      setErrorMessage("出題するアンカー項目が読み込めていません。ページを再読み込みしてください。");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
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
          setCurrentStep("anchor_stage1");
          setStageStartTime(Date.now());
          addTelemetry(
            `Anchor stimulus loaded (${selectedAnchorId}, ${anchorData.anchor.format_version}) - pretest mode`
          );
          if (anchorData.retiredWarning) {
            addTelemetry(`WARN ${anchorData.retiredWarning}`);
          }
        } else {
          // ここを黙って通すと、セッションだけ作られて画面が無反応になる。
          setErrorMessage(anchorData.error ?? "アンカー項目の読み込みに失敗しました。");
        }
      } else {
        setErrorMessage(data.error ?? "セッションを開始できませんでした。");
      }
    } catch (e: any) {
      setErrorMessage("セッション開始エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Anchor Flow Step Handlers [D-83]
  //
  // 段階1で確定した判断には戻れない。選択肢を見てから遡って書き換えられると、
  // 「言われずに気づいたか」という段階1の測定が意味を失う。
  const handleStage1Next = () => {
    if (!stage1Choice || !currentAnchor) return;
    const duration = Date.now() - stageStartTime;
    setStage1DurationMs(duration);
    // 類型C（不備なし）の項目は段階2を持たないため飛ばす。
    const next = currentAnchor.stage2 ? "anchor_stage2" : "anchor_stage3";
    setCurrentStep(next);
    setStageStartTime(Date.now());
    addTelemetry(
      `段階1（採用可否）を確定: ${stage1Choice} / ${(duration / 1000).toFixed(1)}s` +
        (currentAnchor.stage2 ? "" : " — 段階2なし（類型C）")
    );
  };

  const handleStage2Next = () => {
    if (!stage2Choice) return;
    const duration = Date.now() - stageStartTime;
    setStage2DurationMs(duration);
    setCurrentStep("anchor_stage3");
    setStageStartTime(Date.now());
    addTelemetry(
      `段階2（懸念領域）: ${stage2Choice} / 提示順 ${currentAnchor?.stage2_order ?? "—"} / ` +
        `${(duration / 1000).toFixed(1)}s`
    );
  };

  const handleStage3Next = () => {
    if (stage3Choice === null || !currentAnchor) return;
    const duration = Date.now() - stageStartTime;
    setStage3DurationMs(duration);
    // 段階3' はすべての項目には付かない。付く項目を読まれると測れなくなるためである [D-83]。
    const next = currentAnchor.stage3b ? "anchor_stage3b" : "anchor_conf";
    setCurrentStep(next);
    setStageStartTime(Date.now());
    addTelemetry(
      `段階3（前提変化への判断更新）: ${stage3Choice > 0 ? "+" : ""}${stage3Choice} / ` +
        `${(duration / 1000).toFixed(1)}s — 採点は専門家パネル分布（正答鍵なし）`
    );
  };

  // 段階3': 新情報を含まない反論への応答。段階3との差分だけが指標であり、パネルを要さない。
  const handleStage3bNext = () => {
    if (stage3bChoice === null || stage3Choice === null) return;
    const duration = Date.now() - stageStartTime;
    setStage3bDurationMs(duration);
    setCurrentStep("anchor_conf");
    const delta = stage3bChoice - stage3Choice;
    addTelemetry(
      `段階3'（反論への応答）: ${stage3bChoice > 0 ? "+" : ""}${stage3bChoice} / ` +
        `差分 ${delta > 0 ? "+" : ""}${delta} — ` +
        (delta === 0
          ? "保持（新情報のない圧力に対して立場を維持）"
          : "迎合（新情報なしに判断が移動）") +
        ` / ${(duration / 1000).toFixed(1)}s`
    );
  };

  const handleAnchorSubmit = async () => {
    if (!currentAnchor) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const res = await fetch("/api/anchor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          anchorId: currentAnchor.anchor_id,
          formatVersion: currentAnchor.format_version,
          stage1Selection: stage1Choice,
          stage2Selection: stage2Choice || null,
          stage3Selection: stage3Choice,
          stage3bSelection: stage3bChoice,
          stage2Order: currentAnchor.stage2_order,
          stage1DurationMs,
          stage2DurationMs,
          stage3DurationMs,
          stage3bDurationMs,
          confidence,
        }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.anchorStatus) {
          setAnchorStatus(data.anchorStatus);
        }
        addTelemetry(
          `Anchor recorded (Response ID: ${data.responseId.slice(0, 8)}..., ${data.anchorStatus} / 無得点)`
        );
        setCurrentStep("anchor_complete");
      } else {
        setErrorMessage("アンカー記録エラー: " + data.error);
      }
    } catch (e: any) {
      setErrorMessage("送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transition to Dynamic Dialogue Session (W3)
  const handleStartDialogueSession = async () => {
    setErrorMessage(null);
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
        setErrorMessage("課題開始エラー: " + data.error);
        return;
      }
    } catch (e: any) {
      setErrorMessage("課題開始エラー: " + e.message);
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
    setMediationStateEstimate(null);
    setLastProbeMove(null);
    setLastSelectionRationale(null);
    setProbesIssued(0);
    addTelemetry(`Dynamic Task initiated (${selectedTask.task_id})`);
  };

  // Send User Prompt in Dialogue Session (W3)
  const handleSendDialogueTurn = async () => {
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
        setErrorMessage("対話エラー: " + data.error);
        setChatHistory(chatHistory);
        setUserPromptInput(userText);
        return;
      }
      setLastLoggedArtifact(artifactCode);
      if (data.success) {
        let nextTurn = data.assistantTurnSeq + 1;

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
          addTelemetry(`Interlock triggered (Intent-Action Gap)`);
        } else {
          addTelemetry(`AI Peer response recorded (Turn #${data.assistantTurnSeq})`);
        }

        if (data.updatedArtifact) {
          setArtifactCode(data.updatedArtifact);
          addTelemetry(`Artifact draft updated by AI Peer`);
        }

        setTurnCounter(nextTurn);

        // 意図-行動ギャップのインターロック（正規表現ベース。別機構）が発火したターンには
        // 深掘りを重ねない。上限に達していれば呼ばない。
        if (!data.isInterlockTriggered && probesIssued < MAX_PROBES_PER_SESSION) {
          await runMediationProbe(nextTurn, historyWithAssistant);
        }
      }
    } catch (e: any) {
      setErrorMessage("対話送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Mediation Probe (MVP 2.1 ステップ7・8: ソクラテス型深掘り・What-if注入)
  //
  // AI同僚の応答とは別の手番。**正答鍵（injected_flaw_map）はこの呼び出しに含めない**
  // ——渡っているのは selectedTaskId のみで、サーバ側で業務要件・制約と対話ログから
  // 状態推定を行う（src/lib/mediator の注記を参照）。
  const runMediationProbe = async (turnSeq: number, historySoFar: ChatMessage[]) => {
    setIsProbing(true);
    try {
      const res = await fetch("/api/dialogue/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, taskId: selectedTaskId, turnSeq }),
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
        setChatHistory([
          ...historySoFar,
          { turnSeq, role: "mediator", content: data.probeText },
        ]);
        addTelemetry(`Mediation probe issued (${data.probeMove}, Turn #${turnSeq})`);
      } else {
        addTelemetry(`Mediation: no probe needed (${data.reason ?? data.probeMove})`);
      }
    } catch (e: any) {
      addTelemetry(`Mediation probe request failed: ${e.message}`);
    } finally {
      setIsProbing(false);
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

  // Confirm Preliminary Judgement & Execute AutoSCORE Evaluation (W4)
  const handleConfirmPreliminaryAndEvaluate = async () => {
    if (!prelimAction) {
      setPrelimError("成果物の判定（承認または差し戻し）を選択してください。");
      return;
    }

    // [D-80]: 白紙再作文の強制撤廃。受講者が微調整を入力しなかった場合は進行役のミラーリング要約を採用する
    const effectiveJustification =
      prelimJustification.trim() ||
      getDefaultMirroringSummary(selectedTaskId, chatHistory);

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
          sessionId,
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
      addTelemetry(
        `Preliminary judgement recorded: ${prelimAction}`
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
    } catch (e: any) {
      setErrorMessage("評価リクエスト失敗: " + e.message);
    } finally {
      setIsEvaluating(false);
    }
  };

  // Submit Score Dispute (MVP 4.5 / W5)
  const handleSubmitDispute = async () => {
    if (!disputeReason.trim() || !disputeDirection || !evaluation) return;

    setErrorMessage(null);
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
        setErrorMessage("異議申立エラー: " + data.error);
        return;
      }
      if (data.success) {
        setDisputeSubmitted(true);
        addTelemetry(`Score dispute recorded in score_feedback (ID: ${data.feedbackId.slice(0, 8)}...)`);
      }
    } catch (e: any) {
      setErrorMessage("異議申立エラー: " + e.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* 2-Layer Navigation Tab Bar ([D-79]: Viability & Feasibility) */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/80 p-1.5 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab("session")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "session"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>実務演習セッション（Feasibility・中核評価エンジン稼働）</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("org_dashboard")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "org_dashboard"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>① 組織・受講管理ダッシュボード（Viability・モックUI）</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("learner_profile")}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
              activeTab === "learner_profile"
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>② 受講者スキルカルテ（Viability・モックUI）</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 hidden xl:flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span>2層構造プロトタイプ（Viability / Feasibility）</span>
        </div>
      </div>

      {/* Tab 1: Organization Analytics Dashboard */}
      {activeTab === "org_dashboard" && (
        <OrganizationDashboard
          onStartSession={() => setActiveTab("session")}
          onViewLearnerProfile={() => setActiveTab("learner_profile")}
        />
      )}

      {/* Tab 2: Learner Profile & Skill Card */}
      {activeTab === "learner_profile" && (
        <LearnerProfile
          onStartSession={(taskId) => {
            if (taskId) {
              const matched = DYNAMIC_TASKS.find((t) => t.task_id === taskId);
              if (matched) setSelectedTaskId(matched.task_id);
            }
            setActiveTab("session");
          }}
        />
      )}

      {/* Tab 3: Core Evaluation Session (Vertical Cut) */}
      {activeTab === "session" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

          {/* STEP 0: Initialization */}
          {currentStep === "init" && (
            <InitStep
              selectedAnchorId={selectedAnchorId}
              setSelectedAnchorId={setSelectedAnchorId}
              anchorList={anchorList}
              bankSource={bankSource}
              selectedTaskId={selectedTaskId}
              setSelectedTaskId={setSelectedTaskId}
              selectedTask={selectedTask}
              isSubmitting={isSubmitting}
              onStartSession={handleStartSession}
            />
          )}

          {/* STEP 1〜5: Anchor Flow（4段構成 + 完了）[D-83] */}
          {(currentStep === "anchor_stage1" ||
            currentStep === "anchor_stage2" ||
            currentStep === "anchor_stage3" ||
            currentStep === "anchor_stage3b" ||
            currentStep === "anchor_conf" ||
            currentStep === "anchor_complete") && (
            <AnchorQuestionStep
              currentStep={currentStep}
              currentAnchor={currentAnchor}
              bankSource={bankSource}
              stage1Choice={stage1Choice}
              setStage1Choice={setStage1Choice}
              stage2Choice={stage2Choice}
              setStage2Choice={setStage2Choice}
              stage3Choice={stage3Choice}
              setStage3Choice={setStage3Choice}
              stage3bChoice={stage3bChoice}
              setStage3bChoice={setStage3bChoice}
              confidence={confidence}
              setConfidence={setConfidence}
              isSubmitting={isSubmitting}
              onStage1Next={handleStage1Next}
              onStage2Next={handleStage2Next}
              onStage3Next={handleStage3Next}
              onStage3bNext={handleStage3bNext}
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
              mediationStateEstimate={mediationStateEstimate}
              lastProbeMove={lastProbeMove}
              lastSelectionRationale={lastSelectionRationale}
              probesIssued={probesIssued}
              isProbing={isProbing}
              onProceedToPreliminaryJudgement={handleProceedToPreliminaryJudgement}
              onAddFocusItem={handleAddFocusItem}
              onRemoveFocusItem={handleRemoveFocusItem}
              onSendDialogueTurn={handleSendDialogueTurn}
            />
          )}

          {/* STEP 5.5: CFF Force Decision First & Facilitator Mirroring Summary [MVP 2.5, T-17b, D-80] */}
          {currentStep === "preliminary_judgement" && (
            <PreliminaryJudgementStep
              taskId={selectedTaskId}
              chatHistory={chatHistory}
              prelimAction={prelimAction}
              setPrelimAction={setPrelimAction}
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
              prelimJustification={prelimJustification}
              anchorId={selectedAnchorId}
              anchorStatus={anchorStatus}
              bankSource={bankSource}
              stage1Choice={stage1Choice}
              stage2Choice={stage2Choice}
              stage3Choice={stage3Choice}
              confidence={confidence}
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
    )}
  </div>
);
}
