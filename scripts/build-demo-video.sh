#!/usr/bin/env bash
# README 用の動作確認動画を、Playwright の録画（webm）から作る。
#   docs/demo/session.mp4  実務演習セッション（H.264。GitHub の Web 画面から README に貼る）
#   docs/demo/anchor.mp4   固定設問（SCT型）
#   docs/demo/digest.gif   冒頭に置くダイジェスト（検証対話 → 前提変化 → XAI診断）
# 前提：npx playwright test --project=video を先に走らせていること（npm run capture:video は両方やる）
set -euo pipefail

cd "$(dirname "$0")/.."
OUT=docs/demo
MARKS=test-results/demo-video-marks.json

# 録画のディレクトリ名はテスト名から作られる。テスト名の先頭（session / anchor）で見分ける
find_video() {
  find test-results -path "*capture-video-$1*" -name video.webm | head -n 1
}
SESSION_SRC=$(find_video session)
ANCHOR_SRC=$(find_video anchor)

if [ -z "$SESSION_SRC" ] || [ -z "$ANCHOR_SRC" ] || [ ! -f "$MARKS" ]; then
  echo "録画が見つからない。先に npx playwright test --project=video を実行する" >&2
  exit 1
fi
mkdir -p "$OUT"

to_mp4() {
  ffmpeg -v error -y -i "$1" \
    -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -movflags +faststart -an "$2"
}
to_mp4 "$SESSION_SRC" "$OUT/session.mp4"
to_mp4 "$ANCHOR_SRC" "$OUT/anchor.mp4"
# 1本だった頃の名前。残っていると README から古い映像へ辿れてしまう
rm -f "$OUT/demo.mp4"

# ダイジェストは場面ごとに数秒ずつ切り出して繋ぐ。開始位置は spec が記録した時刻
read -r T_DIALOGUE T_SHIFT T_XAI < <(node -e '
  const m = require("./'"$MARKS"'");
  console.log(m.dialogue, m["premise-shift"], m.xai);
')
# mktemp の /tmp は Git Bash と ffmpeg で解釈がずれるので、test-results 配下を作業場所にする
TMP=test-results/demo-video-work
rm -rf "$TMP" && mkdir -p "$TMP"
trap 'rm -rf "$TMP"' EXIT
i=0
for seg in "$T_DIALOGUE 7" "$T_SHIFT 5" "$T_XAI 6"; do
  set -- $seg
  ffmpeg -v error -y -ss "$1" -t "$2" -i "$SESSION_SRC" -an -c:v libx264 -crf 18 "$TMP/seg$i.mp4"
  echo "file 'seg$i.mp4'" >> "$TMP/list.txt"
  i=$((i + 1))
done
ffmpeg -v error -y -f concat -safe 0 -i "$TMP/list.txt" -c copy "$TMP/digest.mp4"
FILTER="fps=10,scale=960:-1:flags=lanczos"
ffmpeg -v error -y -i "$TMP/digest.mp4" -vf "$FILTER,palettegen=stats_mode=diff" "$TMP/palette.png"
ffmpeg -v error -y -i "$TMP/digest.mp4" -i "$TMP/palette.png" \
  -lavfi "$FILTER [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle" \
  "$OUT/digest.gif"

ls -lh "$OUT"
