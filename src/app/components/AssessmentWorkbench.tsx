"use client";

import React, { useEffect, useState } from "react";
import { DYNAMIC_TASKS } from "@/data/dynamic-task";
import { MAX_PROBES_PER_SESSION, type AppTab } from "../types";
import { InitStep } from "./InitStep";
import { AnchorQuestionStep } from "./AnchorQuestionStep";
import { DialogueSessionStep } from "./DialogueSessionStep";
import { PreliminaryJudgementStep } from "./PreliminaryJudgementStep";
import { EvaluationReportStep } from "./EvaluationReportStep";
import { TelemetryPanel } from "./TelemetryPanel";
import { ErrorBanner } from "./ErrorBanner";
import { OrganizationDashboard } from "./OrganizationDashboard";
import { LearnerProfile } from "./LearnerProfile";
import { BenchmarkGallery } from "./BenchmarkGallery";
import { useTelemetryLog } from "../hooks/useTelemetryLog";
import { useLearnerSession } from "../hooks/useLearnerSession";
import { useWindowBlurTelemetry } from "../hooks/useWindowBlurTelemetry";
import { useAnchorFlow } from "../hooks/useAnchorFlow";
import { useDialogueFlow } from "../hooks/useDialogueFlow";
import { Badge, Button, cn } from "./ui";

export interface AssessmentWorkbenchProps {
  initialTaskId?: string;
}

/**
 * 2層構造プロトタイプのクライアント側ステートマシンコンテナ（[D-79]: Viability / Feasibility）。
 *
 * 各フローの状態と手続きは hooks/ 側にあり、本コンポーネントは
 * タブの選択状態と画面の組み立て（ビュー統合）を担当する。
 */
export function AssessmentWorkbench({
  initialTaskId = DYNAMIC_TASKS[0].task_id,
}: AssessmentWorkbenchProps) {
  // Navigation & Tab State ([D-79]: 2-layer Viability & Feasibility)
  const [activeTab, setActiveTab] = useState<AppTab>("session");
  const [galleryTaskId, setGalleryTaskId] = useState<string>(initialTaskId);
  // 計測ログは受講者の作業には要らないので既定で閉じる。本体の下の戻し口から開ける
  const [showTelemetry, setShowTelemetry] = useState<boolean>(false);

  // Dynamic Task Selection (T-06a) — 取り組む動的課題をレジストリから選択する
  const [selectedTaskId, setSelectedTaskId] = useState<string>(initialTaskId);

  const { telemetryLog, addTelemetry, errorMessage, setErrorMessage } = useTelemetryLog();
  const { sessionId, sessionSeq, learnerId, ensureSession } = useLearnerSession(setErrorMessage);

  useWindowBlurTelemetry(sessionId);

  const anchor = useAnchorFlow({ sessionId, ensureSession, addTelemetry, setErrorMessage });
  const dialogue = useDialogueFlow({
    selectedTaskId,
    ensureSession,
    addTelemetry,
    setErrorMessage,
  });

  // URLクエリによる初期タブの反映（?tab=dashboard / ?tab=learner / ?tab=session）
  //
  // マウント時の1回だけで、以後このeffectは走らない。`useSearchParams` で
  // レンダー中に決める方法もあるが、それはこのツリー全体を Suspense 境界の下へ
  // 押し込み、初期HTMLの生成範囲を変える。表示タブの初期値ひとつのために
  // プリレンダリングの形を変えるほどのものではない。
  /* eslint-disable react-hooks/set-state-in-effect -- マウント時の初期化に限る */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab === "dashboard" || tab === "org") {
      setActiveTab("org_dashboard");
    } else if (tab === "profile" || tab === "learner") {
      setActiveTab("learner_profile");
    } else if (tab === "gallery" || tab === "benchmark") {
      setActiveTab("benchmark_gallery");
      const task = params.get("task");
      if (task) setGalleryTaskId(task);
    } else if (tab === "session") {
      setActiveTab("session");
    } else if (tab === "anchor") {
      setActiveTab("anchor");
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** 別タブの「この課題を演習する」から演習タブへ移る */
  const goToSessionWithTask = (taskId?: string) => {
    if (taskId) {
      const matched = DYNAMIC_TASKS.find((t) => t.task_id === taskId);
      if (matched) setSelectedTaskId(matched.task_id);
    }
    setActiveTab("session");
  };

  const TABS: { id: AppTab; label: string; mock: boolean }[] = [
    { id: "session", label: "実務演習セッション", mock: false },
    { id: "anchor", label: "固定設問（SCT型）", mock: false },
    { id: "org_dashboard", label: "組織ダッシュボード", mock: true },
    { id: "learner_profile", label: "受講者カルテ", mock: true },
    { id: "benchmark_gallery", label: "事後講評", mock: true },
  ];

  const telemetryPanel = showTelemetry ? (
    <TelemetryPanel
      learnerId={learnerId}
      sessionId={sessionId}
      sessionSeq={sessionSeq}
      telemetryLog={telemetryLog}
      scorerModelVersion={dialogue.evaluation?.scorerModelVersion ?? null}
      onToggleCollapse={() => setShowTelemetry(false)}
      mediationStateEstimate={dialogue.mediationStateEstimate}
      lastProbeMove={dialogue.lastProbeMove}
      lastSelectionRationale={dialogue.lastSelectionRationale}
      probesIssued={dialogue.probesIssued}
      maxProbes={MAX_PROBES_PER_SESSION}
      isProbing={dialogue.isProbing}
    />
  ) : (
    // 閉じたあとも同じ場所に戻し口を残す。画面の隅にボタンだけ置くと見つからない
    <div className="flex flex-wrap items-center justify-between gap-row rounded-card border border-dashed border-line-strong px-pad py-cell">
      <p className="text-caption text-ink-3">計測ログは閉じています</p>
      <Button variant="secondary" onClick={() => setShowTelemetry(true)} title="計測ログを表示する">
        計測ログを表示
      </Button>
    </div>
  );

  // 対話中は（広い画面で）作業領域を画面の高さに収める。高さは JS で測らず、
  // ヘッダーの固定の高さ（h-12）を引いた残りを flex で配る——測定はタイミング次第でずれる
  const isDialogueWorkspace = activeTab === "session" && dialogue.currentStep === "dialogue_session";

  return (
    <div
      className={cn(
        "mx-auto max-w-[1536px] px-6",
        isDialogueWorkspace
          ? "space-y-block py-block lg:flex lg:h-[calc(100dvh-3rem)] lg:flex-col lg:gap-block lg:space-y-0"
          : "space-y-section py-section",
      )}
    >
      {/* 2-Layer Navigation Tab Bar ([D-79]: Viability & Feasibility) */}
      <div className="shrink-0 border-b border-line">
        <nav className="-mb-px flex flex-wrap items-end gap-x-block gap-y-row" aria-label="画面の切り替え">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 border-b-2 pb-2.5 text-label transition-colors",
                activeTab === tab.id
                  ? "border-accent font-semibold text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              {tab.label}
              {tab.mock && <Badge tone="neutral">モック</Badge>}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Organization Analytics Dashboard */}
      {activeTab === "org_dashboard" && (
        <OrganizationDashboard
          onStartSession={() => setActiveTab("session")}
          onViewLearnerProfile={() => setActiveTab("learner_profile")}
          onViewBenchmarkGallery={(taskId) => {
            if (taskId) setGalleryTaskId(taskId);
            setActiveTab("benchmark_gallery");
          }}
        />
      )}

      {/* Tab 2: Learner Profile & Skill Card */}
      {activeTab === "learner_profile" && (
        <LearnerProfile onStartSession={goToSessionWithTask} />
      )}

      {/* Tab 3: Scenario Benchmark & Archetype Gallery */}
      {activeTab === "benchmark_gallery" && (
        <BenchmarkGallery
          initialTaskId={galleryTaskId}
          onStartSession={goToSessionWithTask}
          onBackToDashboard={() => setActiveTab("org_dashboard")}
        />
      )}

      {/* Tab: Standard Benchmark Anchor */}
      {activeTab === "anchor" && (
        <div className="space-y-block">
          <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />
          <AnchorQuestionStep
            currentStep={anchor.anchorStep}
            currentAnchor={anchor.currentAnchor}
            bankSource={anchor.bankSource}
            anchorList={anchor.anchorList}
            selectedAnchorId={anchor.selectedAnchorId}
            onSelectAnchorId={anchor.setSelectedAnchorId}
            onStartAnchorFlow={anchor.startAnchorFlow}
            onResetAnchorFlow={anchor.resetAnchorFlow}
            stage1Choice={anchor.stage1Choice}
            setStage1Choice={anchor.setStage1Choice}
            stage2Choice={anchor.stage2Choice}
            setStage2Choice={anchor.setStage2Choice}
            stage3Choice={anchor.stage3Choice}
            setStage3Choice={anchor.setStage3Choice}
            stage3bChoice={anchor.stage3bChoice}
            setStage3bChoice={anchor.setStage3bChoice}
            confidence={anchor.confidence}
            setConfidence={anchor.setConfidence}
            isSubmitting={anchor.isSubmitting}
            onStage1Next={anchor.advanceStage1}
            onStage2Next={anchor.advanceStage2}
            onStage3Next={anchor.advanceStage3}
            onStage3bNext={anchor.advanceStage3b}
            onAnchorSubmit={anchor.submitAnchor}
            onStartDialogueSession={() => setActiveTab("session")}
          />
        </div>
      )}

      {/* Tab: Core Evaluation Session (Vertical Cut) */}
      {activeTab === "session" && (
        <div className={cn(isDialogueWorkspace ? "lg:flex lg:min-h-0 lg:flex-1 lg:flex-col" : "space-y-section")}>
          {/* 計測ログは各ステップの下に置く。対話中だけは右列を対話が使うため、
              DialogueSessionStep が2ペインの下へ自分で差し込む */}
          <div
            className={cn(
              "min-w-0",
              isDialogueWorkspace
                ? "space-y-block lg:flex lg:min-h-0 lg:flex-1 lg:flex-col lg:gap-block lg:space-y-0"
                : "space-y-section",
            )}
          >
            <ErrorBanner message={errorMessage} onDismiss={() => setErrorMessage(null)} />

            {/* STEP 0: Initialization */}
            {dialogue.currentStep === "init" && (
              <InitStep
                selectedTaskId={selectedTaskId}
                setSelectedTaskId={setSelectedTaskId}
                selectedTask={dialogue.selectedTask}
                isSubmitting={dialogue.isSubmitting}
                onStartSession={dialogue.startSession}
                onGoToAnchorTab={() => setActiveTab("anchor")}
              />
            )}

            {/* STEP 1: 2ペイン動的対話セッション（W3）。
                ソクラテス媒介の計器は2ペインの下の TelemetryPanel 側にある。 */}
            {dialogue.currentStep === "dialogue_session" && (
              <DialogueSessionStep
                selectedTask={dialogue.selectedTask}
                artifactCode={dialogue.artifactCode}
                setArtifactCode={dialogue.setArtifactCode}
                chatHistory={dialogue.chatHistory}
                turnCounter={dialogue.turnCounter}
                userPromptInput={dialogue.userPromptInput}
                setUserPromptInput={dialogue.setUserPromptInput}
                cffActiveWarning={dialogue.cffActiveWarning}
                isSubmitting={dialogue.isSubmitting}
                premiseShiftState={dialogue.premiseShiftState}
                onForcePremiseShiftForDebug={dialogue.forcePremiseShiftForDebug}
                onProceedToPreliminaryJudgement={dialogue.proceedToPreliminaryJudgement}
                onSendDialogueTurn={dialogue.sendDialogueTurn}
                telemetrySlot={telemetryPanel}
                isTelemetryOpen={showTelemetry}
              />
            )}

            {/* STEP 5.5: CFF Force Decision First & Facilitator Mirroring Summary [MVP 2.5, T-17b, D-80] */}
            {dialogue.currentStep === "preliminary_judgement" && (
              <PreliminaryJudgementStep
                chatHistory={dialogue.chatHistory}
                prelimAction={dialogue.prelimAction}
                setPrelimAction={dialogue.setPrelimAction}
                prelimJustification={dialogue.prelimJustification}
                setPrelimJustification={dialogue.setPrelimJustification}
                prelimError={dialogue.prelimError}
                isEvaluating={dialogue.isEvaluating}
                onBackToDialogue={() => dialogue.setCurrentStep("dialogue_session")}
                onConfirmPreliminaryAndEvaluate={dialogue.confirmPreliminaryAndEvaluate}
              />
            )}

            {/* STEP 6: XAI Evaluation Report Screen (W5) */}
            {dialogue.currentStep === "evaluation_report" && dialogue.evaluation && (
              <EvaluationReportStep
                evaluation={dialogue.evaluation}
                chatHistory={dialogue.chatHistory}
                prelimAction={dialogue.prelimAction}
                prelimJustification={dialogue.prelimJustification}
                disputeReason={dialogue.disputeReason}
                setDisputeReason={dialogue.setDisputeReason}
                disputeDirection={dialogue.disputeDirection}
                setDisputeDirection={dialogue.setDisputeDirection}
                disputeSubmitted={dialogue.disputeSubmitted}
                onSubmitDispute={dialogue.submitDispute}
                onResetToInit={() => dialogue.setCurrentStep("init")}
                onViewBenchmarkGallery={() => {
                  setGalleryTaskId(selectedTaskId);
                  setActiveTab("benchmark_gallery");
                }}
              />
            )}
          </div>

          {dialogue.currentStep !== "dialogue_session" && telemetryPanel}
        </div>
      )}
    </div>
  );
}
