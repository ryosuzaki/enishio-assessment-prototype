import { DYNAMIC_TASKS } from "@/data/dynamic-task";
import { AssessmentWorkbench } from "./components/AssessmentWorkbench";

/**
 * Enishio Assessment Prototype メインページ (Server Component)。
 *
 * [D-79]: Viability & Feasibility 2層構造プロトタイプのエントリーポイント。
 * サーバー側で初期構成を解決し、対話セッション・タブ状態を管理する
 * クライアントワークベンチ (<AssessmentWorkbench />) へ受け渡す。
 */
export default function AssessmentPrototypePage() {
  const defaultTaskId = DYNAMIC_TASKS[0]?.task_id ?? "TASK-FINTECH-AUTH-01";

  return <AssessmentWorkbench initialTaskId={defaultTaskId} />;
}
