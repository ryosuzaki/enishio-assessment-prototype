"use client";

import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Zap,
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
  Send,
  Sparkles,
  FileText,
  MessageSquare,
  RefreshCw,
  Award,
} from "lucide-react";

interface AnchorItem {
  anchor_id: string;
  family: string;
  title: string;
  intro: string;
  proposal: string;
  q1: {
    question: string;
    options: { key: string; text: string }[];
  };
  q2: {
    question: string;
    options: { key: string; text: string }[];
  };
}

export default function AssessmentPrototypePage() {
  // Session State
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionSeq, setSessionSeq] = useState<number>(1);
  const [learnerId, setLearnerId] = useState<string>("");
  const [currentStep, setCurrentStep] = useState<"init" | "anchor_q1" | "anchor_q2" | "anchor_conf" | "anchor_complete" | "dialogue">("init");

  // Anchor State
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

  // Status & Telemetry
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [telemetryLog, setTelemetryLog] = useState<string[]>([]);

  // Load anchor list
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
    setTelemetryLog((prev) => [`[${time}] ${msg}`, ...prev.slice(0, 19)]);
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
          addTelemetry(`Anchor stimulus loaded (${selectedAnchorId}) - pretest mode active`);
        }
      }
    } catch (e: any) {
      alert("セッション開始エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step Transitions in Anchor Flow
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
          learnerId,
          sessionSeq,
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
        addTelemetry(`Anchor completed & recorded (Rating ID: ${data.ratingId.slice(0, 8)}..., unscored)`);
        setCurrentStep("anchor_complete");
      }
    } catch (e: any) {
      alert("送信エラー: " + e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Assessment Flow */}
        <div className="lg:col-span-2 space-y-6">
          {/* STEP 0: Initialization */}
          {currentStep === "init" && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl">
              <div className="flex items-center gap-3 mb-4 text-blue-400 font-semibold text-sm">
                <Sparkles className="w-5 h-5" />
                <span>審査用縦切りプロトタイプ（T-17 W1〜W2）</span>
              </div>
              <h1 className="text-2xl font-bold text-white mb-3">
                評価的判断力 動的アセスメント セッション開始
              </h1>
              <p className="text-slate-300 text-sm leading-relaxed mb-6">
                本システムは、受講者がAI同僚の生成した成果物ドラフトを批判的に検証する対話プロセスを解析し、
                「前提・トレードオフの可視化力（軸4）」を測定する動的アセスメントの検証デモです。
              </p>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4 mb-6">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                  出題する共通アンカー項目の選択（T-05バンク / 全20項目）
                </label>
                <select
                  value={selectedAnchorId}
                  onChange={(e) => setSelectedAnchorId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {anchorList.map((a) => (
                    <option key={a.anchor_id} value={a.anchor_id}>
                      [{a.anchor_id}] {a.title} ({a.family === "A" ? "設計" : "プロセス"})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-500">
                  ※実稼働時はセッション列の7回に1回、受講者には告知されずランダムに自動混入されます（`anchor_status: pretest`）。
                </p>
              </div>

              <button
                onClick={handleStartSession}
                disabled={isSubmitting}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <RefreshCw className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    セッションを開始する（アンカー出題へ）
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          )}

          {/* STEP 1: Anchor Q1 */}
          {currentStep === "anchor_q1" && currentAnchor && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  共通アンカー項目: {currentAnchor.anchor_id}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 設問 1 / 2（前提の抽出）
                </span>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">導入文</h2>
                <p className="text-sm text-slate-200 bg-slate-950/50 p-3.5 rounded-lg border border-slate-800/80">
                  {currentAnchor.intro}
                </p>
              </div>

              <div>
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5 text-blue-400" />
                  AI同僚の提案文
                </h2>
                <div className="text-sm text-slate-100 bg-blue-950/20 p-4 rounded-lg border border-blue-900/40 leading-relaxed">
                  「{currentAnchor.proposal}」
                </div>
              </div>

              <div className="space-y-3 pt-2">
                <h3 className="text-sm font-semibold text-white">
                  設問1: {currentAnchor.q1.question}
                </h3>
                <div className="space-y-2.5">
                  {currentAnchor.q1.options.map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        q1Choice === opt.key
                          ? "bg-blue-600/15 border-blue-500 text-white shadow-md shadow-blue-500/10"
                          : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="q1"
                        value={opt.key}
                        checked={q1Choice === opt.key}
                        onChange={(e) => setQ1Choice(e.target.value)}
                        className="mt-1 text-blue-600 focus:ring-0"
                      />
                      <div className="text-sm leading-relaxed">
                        <span className="font-bold mr-2 text-blue-400">{opt.key}:</span>
                        {opt.text}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleQ1Next}
                  disabled={!q1Choice}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition-all disabled:opacity-40"
                >
                  設問2へ進む
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Anchor Q2 */}
          {currentStep === "anchor_q2" && currentAnchor && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  共通アンカー項目: {currentAnchor.anchor_id}
                </span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 設問 2 / 2（トレードオフ・リスクの深掘り）
                </span>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-white">
                  設問2: {currentAnchor.q2.question}
                </h3>
                <div className="space-y-2.5">
                  {currentAnchor.q2.options.map((opt) => (
                    <label
                      key={opt.key}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all cursor-pointer ${
                        q2Choice === opt.key
                          ? "bg-indigo-600/15 border-indigo-500 text-white shadow-md shadow-indigo-500/10"
                          : "bg-slate-950/40 border-slate-800 text-slate-300 hover:border-slate-700"
                      }`}
                    >
                      <input
                        type="radio"
                        name="q2"
                        value={opt.key}
                        checked={q2Choice === opt.key}
                        onChange={(e) => setQ2Choice(e.target.value)}
                        className="mt-1 text-indigo-600 focus:ring-0"
                      />
                      <div className="text-sm leading-relaxed">
                        <span className="font-bold mr-2 text-indigo-400">{opt.key}:</span>
                        {opt.text}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={handleQ2Next}
                  disabled={!q2Choice}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-all disabled:opacity-40"
                >
                  確信度評定へ
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Confidence Scale */}
          {currentStep === "anchor_conf" && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center gap-2 text-indigo-400 font-semibold text-sm">
                <HelpCircle className="w-5 h-5" />
                <span>確信度の自己評定（5段階）</span>
              </div>
              <h2 className="text-lg font-bold text-white">
                設問1および設問2の回答に対するご自身の確信度を選んでください
              </h2>
              <div className="grid grid-cols-5 gap-3 pt-2">
                {[1, 2, 3, 4, 5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setConfidence(val)}
                    className={`p-4 rounded-xl border text-center transition-all ${
                      confidence === val
                        ? "bg-blue-600 border-blue-500 text-white font-bold shadow-lg shadow-blue-500/20"
                        : "bg-slate-950/50 border-slate-800 text-slate-300 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-lg font-bold mb-1">{val}</div>
                    <div className="text-[10px] text-slate-400 leading-tight">
                      {val === 1 && "全く自信なし"}
                      {val === 2 && "やや不安"}
                      {val === 3 && "普通"}
                      {val === 4 && "やや自信あり"}
                      {val === 5 && "非常に確信"}
                    </div>
                  </button>
                ))}
              </div>

              <div className="pt-6 flex justify-end">
                <button
                  onClick={handleAnchorSubmit}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-medium hover:from-blue-500 hover:to-indigo-500 transition-all shadow-lg shadow-blue-500/25 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      アンカー回答を送信・記録する
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Anchor Completed Screen */}
          {currentStep === "anchor_complete" && (
            <div className="glass-panel p-8 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-6">
              <div className="flex items-center gap-3 text-emerald-400">
                <CheckCircle2 className="w-8 h-8" />
                <div>
                  <h2 className="text-xl font-bold text-white">共通アンカー課題の記録が完了しました</h2>
                  <p className="text-xs text-slate-400">
                    ステータス: <span className="font-mono text-emerald-400">anchor_status = pretest</span>（尺度較正用・無得点運用）
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-sm text-slate-300 space-y-2">
                <p className="font-semibold text-slate-200">📌 測定理論上の運用仕様（MVP 2.6.2 / D-51）:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-slate-400">
                  <li>受講者には正誤判定や得点は表示されず、回答・確信度・所要時間がテレメトリへ直ちに記録されます。</li>
                  <li>Stage 0では全項目pretest（無得点）として蓄積され、一定観測量（50〜100件）蓄積後にMFRM較正を経てoperationalへ昇格します。</li>
                </ul>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={() => setCurrentStep("init")}
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  ← 別のアンカー項目を試す
                </button>
                <div className="text-xs text-slate-500 font-mono">
                  W1・W2 縦切り検証完了
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Live Telemetry & System Diagnostics */}
        <div className="space-y-6">
          {/* Telemetry Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                <Zap className="w-4 h-4 text-amber-400" />
                Live Telemetry Monitor
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Connected
              </span>
            </div>

            <div className="space-y-2 text-xs font-mono">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Learner ID:</span>
                <span className="text-slate-300 truncate max-w-[160px]" title={learnerId}>
                  {learnerId ? learnerId.slice(0, 16) + "..." : "Not initialized"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Session Seq:</span>
                <span className="text-blue-400 font-bold">
                  {sessionId ? `#${sessionSeq}` : "-"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-500">Target Axis:</span>
                <span className="text-purple-400 font-semibold">軸4（Epistemic & Ethical）</span>
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                Event Log
              </div>
              <div className="h-52 overflow-y-auto bg-slate-950/80 p-3 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 space-y-1.5">
                {telemetryLog.length === 0 ? (
                  <div className="text-slate-600 italic">待機中... セッションを開始するとイベントが記録されます</div>
                ) : (
                  telemetryLog.map((log, i) => (
                    <div key={i} className="leading-snug text-slate-300">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Audit & Compliance Card */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-slate-900/60 shadow-xl space-y-3 text-xs text-slate-400">
            <div className="flex items-center gap-2 text-slate-200 font-semibold">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              未踏アドバンスト審査用仕様準拠
            </div>
            <p className="leading-relaxed text-[11px]">
              本プロトタイプは、[実行指示書 T-17](products/enishio-education/docs/実行指示書_T-17_審査用縦切りプロトタイプ.md)
              で定義されたデータモデル（`learners`, `sessions`, `ratings`, `anchor_responses`）の本番仕様に完全準拠して動作しています。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
