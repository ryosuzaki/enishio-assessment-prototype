// サーバ専用。**このモジュールをクライアントコンポーネントから import してはならない。**
// 仕込み不備の位置・類型・正常箇所ラベル（[P-15]）＝アセスメントの正答鍵である。
// クライアントへ渡ると受検者が DevTools で全て読めるため、縦切りの測定が成立しなくなる。

export interface InjectedFlaw {
  flaw_id: string;
  flaw_type: "type_A" | "type_B" | "type_C";
  title: string;
  span_text: string;
  is_flaw: boolean; // false indicates intentional valid code that looks suspicious but MUST be approved [P-15]
  description: string;
}

export const INJECTED_FLAWS: InjectedFlaw[] = [
  {
    flaw_id: "FLAW-01",
    flaw_type: "type_B",
    title: "トークン失効（強制ログアウト）の完全無視（結果整合性・セキュリティ前提の隠蔽）",
    span_text: "JWT署名のみをローカル検証し、Redis/DBでの失効チェックはスキップ",
    is_flaw: true,
    description: "PCI DSSおよび要件2に反し、ログアウトや不正検知で失効したトークンが24時間有効なまま通過してしまう重大なセキュリティ欠陥。",
  },
  {
    flaw_id: "FLAW-02",
    flaw_type: "type_A",
    title: "単一障害点（Redis障害時に決済全体が全停止する過剰なフェイルクローズ）",
    span_text: "全リクエストを一律500エラーで落とす",
    is_flaw: true,
    description: "要件3の耐障害性要件に反し、Redisの瞬断で全加盟店の決済が完全停止してしまう。",
  },
  {
    flaw_id: "VALID-01",
    flaw_type: "type_C",
    title: "正常箇所：過去世代キーIDの許容（一見疑わしいが承認すべきローテーション設計）",
    span_text: "過去2世代のキーIDを許容するフェイルセーフ設計",
    is_flaw: false,
    description: "鍵更新時のゼロダウンタイム移行に不可欠な正当設計。[P-15]に基づき、AI過信ではなく正当な判断として承認すべき箇所。",
  },
];

export const AI_PEER_SYSTEM_PROMPT = `あなたは決済開発チームのAI同僚（エージェント）です。
自分の書いたコードにプライドを持っていますが、受講者から具体的・論理的な指摘（トレードオフや要件との不整合）を受けた場合は、素直に修正案を提示します。
ただし、受講者が「適当に修正して」「なんか直して」等の曖昧な指示を出した場合は、「具体的にどの要件・リスクを問題視されていますか？」と問い返してください。`;
