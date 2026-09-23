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
import { Button, cn } from "./ui";

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
  const [showTelemetry, setShowTelemetry] = useState<boolean>(true);

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

  /** 別タブの「この課題を演習する」から演習タブへ移る */
  const goToSessionWithTask = (taskId?: string) => {
    if (taskId) {
      const matched = DYNAMIC_TASKS.find((t) => t.task_id === taskId);
      if (matched) setSelectedTaskId(matched.task_id);
    }
    setActiveTab("session");
  };

  const TABS: { id: AppTab; label: string }[] = [
    { id: "session", label: "実務演習セッション（2ペイン動的対話）" },
    { id: "anchor", label: "共通アンカー評価（固定尺度・SCT型）" },
    { id: "org_dashboard", label: "① 組織・受講管理ダッシュボード" },
    { id: "learner_profile", label: "② 受講者スキルカルテ" },
    { id: "benchmark_gallery", label: "③ エキスパート事後講評" },
  ];

  return (
    <div className="mx-auto max-w-[1536px] space-y-section px-6 py-section">
      {/* 2-Layer Navigation Tab Bar ([D-79]: Viability & Feasibility) */}
      <div className="flex flex-col gap-row border-b border-line sm:flex-row sm:items-end sm:justify-between">
        <nav className="-mb-px flex flex-wrap items-end gap-x-block gap-y-row" aria-label="画面の切り替え">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-current={activeTab === tab.id ? "page" : undefined}
              className={cn(
                "border-b-2 pb-2.5 text-label transition-colors",
                activeTab === tab.id
                  ? "border-accent font-semibold text-ink"
                  : "border-transparent text-ink-3 hover:text-ink-2",
              )}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <span className="hidden pb-2.5 text-label text-ink-3 xl:block">
          2層構造プロトタイプ（Viability / Feasibility）
        </span>
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
        <div className="space-y-4">
          {!showTelemetry && (
            <div className="flex justify-end">
              <Button
                variant="secondary"
                onClick={() => setShowTelemetry(true)}
                title="テレメトリモニターを展開する"
              >
                Live Telemetry を表示
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-section lg:grid-cols-12">
            {/* Main Content Area */}
            <div
              className={`${
                showTelemetry ? "lg:col-span-8 xl:col-span-9" : "col-span-12"
              } space-y-section min-w-0 transition-all`}
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

              {/* STEP 1: Dynamic 3-Pane Dialogue Session (W3) */}
              {dialogue.currentStep === "dialogue_session" && (
                <DialogueSessionStep
                  selectedTask={dialogue.selectedTask}
                  artifactCode={dialogue.artifactCode}
                  setArtifactCode={dialogue.setArtifactCode}
                  focusItems={dialogue.focusItems}
                  focusInputText={dialogue.focusInputText}
                  setFocusInputText={dialogue.setFocusInputText}
                  chatHistory={dialogue.chatHistory}
                  turnCounter={dialogue.turnCounter}
                  userPromptInput={dialogue.userPromptInput}
                  setUserPromptInput={dialogue.setUserPromptInput}
                  cffActiveWarning={dialogue.cffActiveWarning}
                  isSubmitting={dialogue.isSubmitting}
                  mediationStateEstimate={dialogue.mediationStateEstimate}
                  lastProbeMove={dialogue.lastProbeMove}
                  lastSelectionRationale={dialogue.lastSelectionRationale}
                  probesIssued={dialogue.probesIssued}
                  isProbing={dialogue.isProbing}
                  premiseShiftState={dialogue.premiseShiftState}
                  onForcePremiseShiftForDebug={dialogue.forcePremiseShiftForDebug}
                  onProceedToPreliminaryJudgement={dialogue.proceedToPreliminaryJudgement}
                  onAddFocusItem={dialogue.addFocusItem}
                  onRemoveFocusItem={dialogue.removeFocusItem}
                  onSendDialogueTurn={dialogue.sendDialogueTurn}
                />
              )}

              {/* STEP 5.5: CFF Force Decision First & Facilitator Mirroring Summary [MVP 2.5, T-17b, D-80] */}
              {dialogue.currentStep === "preliminary_judgement" && (
                <PreliminaryJudgementStep
                  taskId={selectedTaskId}
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
                  anchorId={anchor.selectedAnchorId}
                  anchorStatus={anchor.anchorStatus}
                  bankSource={anchor.bankSource}
                  stage1Choice={anchor.stage1Choice}
                  stage2Choice={anchor.stage2Choice}
                  stage3Choice={anchor.stage3Choice}
                  confidence={anchor.confidence}
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

            {/* Right Column: Live Telemetry Monitor & System Architecture */}
            {showTelemetry && (
              <div className="lg:col-span-4 xl:col-span-3 space-y-block min-w-0">
                <TelemetryPanel
                  learnerId={learnerId}
                  sessionId={sessionId}
                  sessionSeq={sessionSeq}
                  telemetryLog={telemetryLog}
                  onToggleCollapse={() => setShowTelemetry(false)}
                  mediationStateEstimate={dialogue.mediationStateEstimate}
                  lastProbeMove={dialogue.lastProbeMove}
                  lastSelectionRationale={dialogue.lastSelectionRationale}
                  probesIssued={dialogue.probesIssued}
                  maxProbes={MAX_PROBES_PER_SESSION}
                  isProbing={dialogue.isProbing}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
