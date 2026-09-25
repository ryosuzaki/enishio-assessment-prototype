import { test, expect, type Locator, type Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import { installMockApi } from "./support/mock-api";

/**
 * README 用の動作確認動画を撮る（npm run capture:video）。実務演習セッションと固定設問の2本。
 * 操作は capture-screenshots.spec.ts と同じ固定応答で進めるので、何度撮っても同じ映像になる。
 * 録画（webm）は test-results/ に出る。mp4 / GIF への変換は scripts/build-demo-video.sh が行う。
 * 変換スクリプトはテスト名の先頭（session / anchor）で録画を見分けるので、名前を変えるときは両方直す。
 *
 * Playwright の録画にはマウスカーソルが写らないため、偽のカーソルと字幕をページに重ねる。
 */

const VIEWPORT = { width: 1280, height: 720 };

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
  video: { mode: "on", size: VIEWPORT },
});

// 録画にだけ使う重ね表示。ページ遷移をまたいで残るよう init script で入れる
const OVERLAY_SCRIPT = `
(() => {
  const install = () => {
    if (document.getElementById("__demo-cursor")) return;
    const style = document.createElement("style");
    style.textContent = \`
      /* 開発ビルドにしか出ない部品は本番の見た目に合わせて隠す [D-100] */
      [data-testid="debug-force-premise-shift"], nextjs-portal { display: none !important; }
      #__demo-cursor { position: fixed; left: 0; top: 0; width: 22px; height: 22px; z-index: 2147483647;
        pointer-events: none; transform: translate(-3px, -2px); transition: transform 0.08s; }
      #__demo-cursor.down svg { transform: scale(0.85); }
      #__demo-caption { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 2147483646;
        pointer-events: none; max-width: 1000px; padding: 12px 22px; border-radius: 10px;
        background: rgba(17, 24, 39, 0.88); color: #fff; font: 600 20px/1.5 "Yu Gothic UI", "Meiryo", sans-serif;
        text-align: center; opacity: 0; transition: opacity 0.35s; box-shadow: 0 6px 24px rgba(0,0,0,0.25); }
      #__demo-caption small { display: block; font-weight: 400; font-size: 15px; color: #d1d5db; margin-top: 2px; }
      #__demo-caption.show { opacity: 1; }
      #__demo-card { position: fixed; inset: 0; z-index: 2147483645; display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 14px; background: #0f172a; color: #fff;
        font-family: "Yu Gothic UI", "Meiryo", sans-serif; opacity: 0; transition: opacity 0.5s; pointer-events: none; }
      #__demo-card.show { opacity: 1; }
      #__demo-card .title { font-size: 40px; font-weight: 700; margin: 0; }
      #__demo-card p { font-size: 20px; color: #cbd5e1; margin: 0; }
      #__demo-card .note { font-size: 15px; color: #94a3b8; margin-top: 18px; }
    \`;
    document.head.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "__demo-cursor";
    cursor.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M3 2l7 19 2.5-7.5L20 11z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursor);
    const caption = document.createElement("div");
    caption.id = "__demo-caption";
    document.body.appendChild(caption);
    const card = document.createElement("div");
    card.id = "__demo-card";
    document.body.appendChild(card);
    const pos = window.__demoCursorPos || { x: 640, y: 360 };
    cursor.style.left = pos.x + "px";
    cursor.style.top = pos.y + "px";
    document.addEventListener("mousemove", (e) => {
      cursor.style.left = e.clientX + "px";
      cursor.style.top = e.clientY + "px";
      window.__demoCursorPos = { x: e.clientX, y: e.clientY };
    }, true);
    document.addEventListener("mousedown", () => cursor.classList.add("down"), true);
    document.addEventListener("mouseup", () => cursor.classList.remove("down"), true);
  };
  window.__demoCaption = (text, sub) => {
    install();
    const el = document.getElementById("__demo-caption");
    if (!text) { el.classList.remove("show"); return; }
    el.innerHTML = "";
    el.append(document.createTextNode(text));
    if (sub) { const s = document.createElement("small"); s.textContent = sub; el.append(s); }
    el.classList.add("show");
  };
  window.__demoCard = (title, sub, note) => {
    install();
    const el = document.getElementById("__demo-card");
    if (!title) { el.classList.remove("show"); return; }
    el.innerHTML = "";
    const h = document.createElement("div"); h.className = "title"; h.textContent = title; el.append(h);
    if (sub) { const p = document.createElement("p"); p.textContent = sub; el.append(p); }
    if (note) { const n = document.createElement("p"); n.className = "note"; n.textContent = note; el.append(n); }
    el.classList.add("show");
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
})();
`;

declare global {
  interface Window {
    __demoCaption: (text: string | null, sub?: string) => void;
    __demoCard: (title: string | null, sub?: string, note?: string) => void;
  }
}

// GIF ダイジェストの切り出し位置。録画の開始はページ生成時なので、テスト開始からの経過秒で近似する
const MARKS_PATH = path.resolve(process.cwd(), "test-results/demo-video-marks.json");

function createMarker() {
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  return {
    mark: (name: string) => {
      marks[name] = (Date.now() - t0) / 1000;
    },
    save: () => {
      fs.mkdirSync(path.dirname(MARKS_PATH), { recursive: true });
      fs.writeFileSync(MARKS_PATH, JSON.stringify(marks, null, 2));
    },
  };
}

const pause = (page: Page, ms: number) => page.waitForTimeout(ms);

async function caption(page: Page, text: string | null, sub?: string) {
  await page.evaluate(([t, s]) => window.__demoCaption(t, s), [text, sub] as const);
}

async function card(page: Page, title: string | null, sub?: string, note?: string) {
  await page.evaluate(([t, s, n]) => window.__demoCard(t, s, n), [title, sub, note] as const);
}

/** 要素を画面中央へなめらかにスクロールする */
async function reveal(page: Page, target: Locator, block: ScrollLogicalPosition = "center") {
  await target.evaluate(
    (el, b) => el.scrollIntoView({ behavior: "smooth", block: b as ScrollLogicalPosition }),
    block,
  );
  await pause(page, 700);
}

/** カーソルを要素まで動かす（人が操作しているように見せるため、一瞬で飛ばさない） */
async function moveTo(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  if (!box) throw new Error("要素の位置が取れない");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 20 });
  await pause(page, 250);
}

async function humanClick(page: Page, target: Locator) {
  await moveTo(page, target);
  await target.click();
  await pause(page, 400);
}

async function humanCheck(page: Page, target: Locator) {
  await moveTo(page, target);
  await target.check();
  await pause(page, 400);
}

/**
 * 入力欄に1文字ずつ打つ。`click: false` は、引用の挿入などでアプリがすでにカーソルを
 * 置いている場合に使う（クリックするとカーソルがクリック位置＝文の途中へ動いてしまう）。
 */
async function humanType(page: Page, target: Locator, text: string, { click = true } = {}) {
  if (click) {
    await humanClick(page, target);
  } else {
    await moveTo(page, target);
  }
  await page.keyboard.type(text, { delay: 28 });
  await pause(page, 500);
}

async function smoothScrollTo(page: Page, y: number) {
  await page.evaluate((top) => window.scrollTo({ top, behavior: "smooth" }), y);
  await pause(page, 900);
}

/** 応答を返すまでの待ち時間。固定応答は一瞬で返るため、そのままだと AI が考えている間が映らない */
function latencyFor(url: string, method: string): number {
  if (url.endsWith("/evaluate")) return 2200;
  if (url.endsWith("/api/anchor")) return method === "POST" ? 800 : 0;
  return 1300;
}

async function setUp(page: Page) {
  test.setTimeout(5 * 60 * 1000);
  await installMockApi(page);
  // 後から登録したハンドラが先に呼ばれるので、ここで待ってからモックへ渡す
  await page.route(/\/api\/(dialogue\/(turn|probe|evaluate)|anchor)$/, async (route) => {
    const req = route.request();
    await new Promise((r) => setTimeout(r, latencyFor(req.url(), req.method())));
    await route.fallback();
  });
  await page.addInitScript(OVERLAY_SCRIPT);
  return page.getByRole("navigation", { name: "画面の切り替え" });
}

test("session: 実務演習セッションの動作確認動画", async ({ page }) => {
  const nav = await setUp(page);
  const { mark, save } = createMarker();

  // ── 0. タイトル ──────────────────────────────
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("実務演習セッション");
  await card(
    page,
    "実務演習セッション",
    "課題提示 → 検証対話 → 前提変化 → 意思決定 → XAI診断",
    "この動画のAI応答は、再現性のため固定データで再生しています",
  );
  await pause(page, 4200);
  await card(page, null);
  await pause(page, 600);

  // ── 1. 課題提示 ──────────────────────────────
  await caption(page, "場面1　課題提示", "AI同僚と一緒にPRをレビューする。課題は3種類から選べる");
  await pause(page, 1500);
  await moveTo(page, page.getByRole("combobox", { name: "取り組む課題" }));
  await pause(page, 1200);
  await humanClick(page, page.getByRole("button", { name: "計測ログを表示" }));
  await pause(page, 800);
  await humanClick(page, page.getByRole("button", { name: "演習を開始する" }));
  await expect(page.getByText("【第1ペイン】開発Issue ＆ チーム情報")).toBeVisible();
  await pause(page, 1500);
  await caption(page, "上段に業務要件とPRのコード", "仕様書を読み、設計の欠陥と仕様上妥当な箇所を見分ける");
  await smoothScrollTo(page, 250);
  await pause(page, 2200);

  // ── 2. 検証対話 ──────────────────────────────
  await caption(page, "場面2　検証対話", "気になるコードを選択して、そのまま対話欄へ引用できる");
  const codeEditor = page.getByTestId("draft-code-editor");
  await reveal(page, codeEditor);
  await moveTo(page, codeEditor);
  // 1行目（コードの見出しコメント）を行末まで選ぶ。文字数で切ると単語の途中で途切れる
  await codeEditor.evaluate((el: HTMLTextAreaElement) => {
    el.focus();
    const lineEnd = el.value.indexOf("\n");
    el.setSelectionRange(0, lineEnd === -1 ? el.value.length : lineEnd);
  });
  await pause(page, 900);
  await humanClick(page, page.getByTestId("quote-code-btn"));
  await expect(page.getByText("コードをチャット欄に引用しました")).toBeVisible();

  const promptInput = page.getByPlaceholder(/AI同僚に指示・指摘を入力/);
  await reveal(page, promptInput);
  await caption(page, "場面2　検証対話", "仕様や規程を根拠に、AI同僚の設計を検証・是正する");
  // 引用の直後はアプリがカーソルを引用の後ろに置いている。クリックせずに続けて打つ
  await expect(promptInput).toBeFocused();
  await humanType(
    page,
    promptInput,
    "Redisの単一障害点（SPOF）およびPCI DSS要件に対する耐障害性について考慮が必要です。フォールバック処理の実装を検討してください。",
    { click: false },
  );
  mark("dialogue");
  await humanClick(page, page.getByRole("button", { name: "送信" }));
  await expect(page.getByText("ご指摘ありがとうございます。Redisのフェイルオーバー時").first()).toBeVisible();
  await pause(page, 1500);
  const probe = page.getByText("その判断の前提（SPOFリスク）を、仕様のどの記述");
  await expect(probe).toBeVisible();
  await caption(page, "進行役が深掘りの問いを出す", "対話ログから「まだ引き出せていない根拠」を推定している（正解は知らされていない）");
  await reveal(page, probe);
  await pause(page, 3500);

  // ── 3. 前提変化 ──────────────────────────────
  await caption(page, "場面2　検証対話", "方針を指示すると……");
  await reveal(page, promptInput);
  await humanType(page, promptInput, "一般加盟店はPCI DSS監査に従いフェイルクローズを維持する方針で修正してください。");
  await humanClick(page, page.getByRole("button", { name: "送信" }));
  const shiftNotice = page.getByText("緊急仕様変更・追加要件が通知されました");
  await expect(shiftNotice).toBeVisible();
  mark("premise-shift");
  await caption(page, "場面3　前提変化", "方針が固まったところで、進行役が緊急の仕様変更を自動で注入する");
  await reveal(page, shiftNotice);
  await pause(page, 2500);
  await smoothScrollTo(page, 0);
  await caption(page, "場面3　前提変化", "当初の方針に固執せず、組み直せるかを見る");
  await pause(page, 3000);

  // ── 4. 意思決定 ──────────────────────────────
  const toDecision = page.getByRole("button", { name: "レビュー完了 ➔ 暫定判断へ進む" });
  await reveal(page, toDecision);
  await humanClick(page, toDecision);
  await expect(page.getByText("場面4：意思決定")).toBeVisible();
  await smoothScrollTo(page, 0);
  await caption(page, "場面4　意思決定", "AIの採点を見る前に、判定と理由を自分で確定する");
  await pause(page, 2000);
  const remand = page.locator("input[value='remand']");
  await reveal(page, remand);
  await humanCheck(page, remand);
  const justification = page.getByPlaceholder(/進行役の要約に補足や微調整がある場合のみ入力/);
  await reveal(page, justification);
  await humanType(
    page,
    justification,
    "Redis障害時の単一障害点リスクとPCI DSSの監査要件への適合に懸念が残るため、差し戻しと判定する。",
  );
  const submitDecision = page.getByRole("button", { name: "判定を確定して採点する" });
  await reveal(page, submitDecision);
  await humanClick(page, submitDecision);

  // ── 5. XAI診断 ──────────────────────────────
  await caption(page, "場面5　XAI診断", "対話ログから検証行動を抽出し（第1段）、その証拠だけで採点する（第2段）");
  await expect(page.getByText("XAI診断（構造化採点パイプラインによる2段階採点）")).toBeVisible();
  mark("xai");
  await smoothScrollTo(page, 0);
  await pause(page, 3000);
  const contrast = page.getByTestId("discrepancy-highlighting-block");
  await reveal(page, contrast, "start");
  await caption(page, "場面5　XAI診断", "自分の判定と、AIが抽出した検証行動を突き合わせる");
  await pause(page, 3200);
  const reasons = page.getByText("判定の根拠", { exact: true });
  await reveal(page, reasons, "start");
  await caption(page, "場面5　XAI診断", "評点には判定の根拠と、次に伸ばすところが付く");
  await pause(page, 3200);
  const chatLog = page.getByText("対話ログ（根拠ハイライト付き）");
  await reveal(page, chatLog, "start");
  await caption(page, "場面5　XAI診断", "採点の根拠になった発言を、対話ログ上でハイライトする");
  await pause(page, 3200);
  const tooLow = page.locator("input[value='too_low']");
  await reveal(page, tooLow);
  await caption(page, "場面5　XAI診断", "受講者は評点に異議を申し立てられる");
  await humanCheck(page, tooLow);
  await humanType(
    page,
    page.getByPlaceholder(/異議の理由を具体的に記述してください/),
    "ターン2の要件指摘とコード引用は、Band 4の基準に当たると考えます。",
  );
  await pause(page, 1200);

  // ── 6. モック画面 ──────────────────────────────
  await smoothScrollTo(page, 0);
  await caption(page, "ここから先はモック画面", "組織ダッシュボード・受講者カルテ・事後講評（静的データ）");
  await humanClick(page, nav.getByRole("button", { name: /組織ダッシュボード/ }));
  await expect(page.locator("h1")).toContainText("組織・受講管理ダッシュボード");
  await pause(page, 2600);
  await humanClick(page, nav.getByRole("button", { name: /受講者カルテ/ }));
  await expect(page.locator("h1")).toContainText("スキルカルテ");
  await pause(page, 2600);
  await humanClick(page, nav.getByRole("button", { name: /事後講評/ }));
  await expect(page.locator("h1")).toContainText("シナリオ分析");
  await pause(page, 2600);

  await caption(page, null);
  await card(page, "Enishio Assessment Prototype", "共通尺度化エンジンは事業期間中に実装します");
  await pause(page, 3000);
  save();
});

test("anchor: 固定設問（SCT型）の動作確認動画", async ({ page }) => {
  const nav = await setUp(page);

  // ── 0. タイトル ──────────────────────────────
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("実務演習セッション");
  await card(
    page,
    "固定設問（SCT型）",
    "全受講者が同じ条件で解く、LLMを通さない外部基準",
    "全体判断 → 懸念の所在 → 前提変化での判断更新 → 反論への応答",
  );
  await pause(page, 4200);
  await humanClick(page, nav.getByRole("button", { name: "固定設問（SCT型）" }));
  await card(page, null);
  await expect(page.locator("input[name='anchorItem']:checked")).toBeAttached();
  await pause(page, 600);

  // ── 1. 設問の選択 ──────────────────────────────
  await caption(page, "固定設問とは", "演習の評点だけが動いたとき、動いたのが受講者か採点器かを見分けるための基準");
  await pause(page, 3500);
  const firstItem = page.locator("input[name='anchorItem']").first();
  await reveal(page, firstItem);
  await caption(page, "設問を選ぶ", "運用中の設問は非公開。ここでは公開用サンプルから選ぶ");
  await humanCheck(page, firstItem);
  await pause(page, 800);
  await humanClick(page, page.getByRole("button", { name: "この設問を体験する" }));

  // ── 2. 段階1：全体判断 ──────────────────────────
  await expect(page.getByText(/段階 1（全体判断）/)).toBeVisible();
  await smoothScrollTo(page, 0);
  await caption(page, "段階1　全体判断", "状況とAI同僚の提案を読み、まず採用してよいかだけを答える");
  await pause(page, 3200);
  const stage1 = page.locator("input[name='stage1']").nth(1);
  await reveal(page, stage1);
  await caption(page, "段階1　全体判断", "選択肢に答えは書いていない。確定すると戻れない");
  await humanCheck(page, stage1);
  await humanClick(page, page.getByRole("button", { name: "この判断で確定する" }));

  // ── 3. 段階2：懸念の所在（類型Cの項目には無い） ─────────────
  const stage2 = page.locator("input[name='stage2']").first();
  if (await stage2.isVisible().catch(() => false)) {
    await smoothScrollTo(page, 0);
    await caption(page, "段階2　懸念の所在", "どこに懸念があるかを答える。前提の中身はまだ見せない");
    await pause(page, 2200);
    await reveal(page, stage2);
    await humanCheck(page, stage2);
    await humanClick(page, page.getByRole("button", { name: "次へ" }));
  }

  // ── 4. 段階3：前提変化 ──────────────────────────
  await expect(page.getByText("新しい情報が入りました")).toBeVisible();
  await smoothScrollTo(page, 0);
  await caption(page, "段階3　前提変化への判断更新", "新しい情報が入ったとき、判断をどちらへどれだけ動かすかを答える");
  await pause(page, 3500);
  const stage3 = page.locator("input[name='stage3']").nth(2);
  await reveal(page, stage3);
  await humanCheck(page, stage3);
  await humanClick(page, page.getByRole("button", { name: "確信度評定へ" }));

  // ── 5. 段階3'：反論への応答（付いている項目だけ） ─────────
  const stage3b = page.locator("input[name='stage3b']");
  if (await stage3b.first().isVisible().catch(() => false)) {
    await smoothScrollTo(page, 0);
    await caption(page, "段階3'　反論への応答", "AI同僚が新しい事実なしに押し返してくる。ここで判断が動けば迎合");
    await pause(page, 3500);
    await reveal(page, stage3b.nth(2));
    await humanCheck(page, stage3b.nth(2));
    await humanClick(page, page.getByRole("button", { name: "確信度評定へ" }));
  }

  // ── 6. 確信度と送信 ──────────────────────────────
  await expect(page.getByText("確信度の自己評定（5段階）")).toBeVisible();
  await smoothScrollTo(page, 0);
  await caption(page, "確信度", "ここまでの回答にどれだけ自信があるかを5段階で答える");
  await pause(page, 1500);
  await humanClick(page, page.getByRole("button", { name: /4\s*やや自信あり/ }));
  await humanClick(page, page.getByRole("button", { name: "回答を送信して記録する" }));

  // ── 7. 結果画面 ──────────────────────────────
  await expect(page.getByText("固定設問の回答を記録しました")).toBeVisible();
  await smoothScrollTo(page, 0);
  await caption(page, "記録した回答", "段階ごとの回答を控えとして表示する。正誤は返さない");
  await pause(page, 3500);
  await reveal(page, page.getByTestId("anchor-answer-record"), "start");
  await pause(page, 3000);
  await reveal(page, page.getByText("演習の評点とは別に扱う理由"));
  await caption(page, "記録した回答", "演習の評点とは足し合わせない、別の測定量として扱う");
  await pause(page, 3200);
  await reveal(page, page.getByText(/設計メモ/));
  await caption(page, "正誤を返さない理由", "返すと学習材料になり、固定の基準点そのものが動いてしまう");
  await pause(page, 3500);

  await caption(page, null);
  await card(page, "Enishio Assessment Prototype", "固定設問の採点は、専門家パネルの組成後に有効化します");
  await pause(page, 3000);
});
