#!/bin/bash
# シーンを Final Cut に持ち込める動画にする。
#
#   bash render_clips.sh 27            … 全シーンを不透明の ProRes 422 HQ で
#   bash render_clips.sh 27 G          … 資料Gだけ
#   bash render_clips.sh 27 G alpha    … 背景を抜いた ProRes 4444（映像の上に重ねる用）
#
# 出来るもの: ep<番号>/clips/<資料記号>.mov（1920×1080・30fps）
# 尺は timeline.json の render_ms。台本の尺に合わせるのは Final Cut 側で伸縮せず、
# 前後を切るか、静止の時間を足して合わせる。
set -euo pipefail
EP="${1:-27}"
ONLY="${2:-}"
MODE="${3:-opaque}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="$HERE/ep$EP"
OUT="$DIR/clips"
TMP="$DIR/.frames"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
FPS=30
mkdir -p "$OUT"

scenes=$(python3 -c "
import json,sys
d=json.load(open('$DIR/timeline.json'))
only='$ONLY'
for s in d['scenes']:
    if not only or s['id']==only:
        print(s['id'], s['render_ms'])
")

echo "$scenes" | while read -r ID MS; do
  [ -z "$ID" ] && continue
  NO=$(python3 -c "
import json
d=json.load(open('$DIR/timeline.json'))
print([s['no'] for s in d['scenes'] if s['id']=='$ID'][0])")
  FRAMES=$(python3 -c "print(int(round($MS/1000*$FPS)))")
  rm -rf "$TMP"; mkdir -p "$TMP"
  echo "資料$ID: ${MS}ms / ${FRAMES}コマ"

  if [ "$MODE" = "alpha" ]; then BGQ="&bg=0"; BGFLAG="--default-background-color=00000000"; else BGQ=""; BGFLAG=""; fi

  PATH="$HOME/.local/bin:$PATH" node "$HERE/render_frames.mjs" \
    "file://$DIR/index.html?s=$NO&t=0$BGQ" "$TMP" "$FRAMES" "$FPS" "$MODE"

  if [ "$MODE" = "alpha" ]; then
    ffmpeg -y -hide_banner -loglevel error -framerate $FPS -i "$TMP/%04d.png" \
      -c:v prores_ks -profile:v 4444 -pix_fmt yuva444p10le -alpha_bits 16 "$OUT/$ID.mov"
  else
    ffmpeg -y -hide_banner -loglevel error -framerate $FPS -i "$TMP/%04d.png" \
      -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le "$OUT/$ID.mov"
  fi
  rm -rf "$TMP"
  ls -lh "$OUT/$ID.mov" | awk '{print "  ->", $9, $5}'
done
