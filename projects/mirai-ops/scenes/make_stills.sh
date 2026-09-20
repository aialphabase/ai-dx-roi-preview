#!/bin/bash
# 台本のシーンを、状態ごとに1920×1080のPNGで書き出す（Final Cutに直接置ける形）。
# 使い方: bash make_stills.sh 27
set -euo pipefail
EP="${1:-27}"
THEME="${2:-light}"   # 番組本編に合わせた明るい地が既定。紺地は news
DIR="$(cd "$(dirname "$0")" && pwd)/ep$EP"
OUT="$DIR/stills"
[ "$THEME" != "light" ] && OUT="$DIR/stills-$THEME"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
mkdir -p "$OUT"

python3 - "$DIR/index.html" "$DIR/_still.html" <<'PY'
import sys, io
src, dst = sys.argv[1], sys.argv[2]
s = io.open(src, encoding='utf-8').read()
io.open(dst, 'w', encoding='utf-8').write(
    s.replace('</body>', '<style>*{transition:none!important}#index,#ui,#hint{display:none!important}</style></body>'))  # 番組用: ナビと操作UIは映さない
PY

# シーン数と状態数を index.html から拾う
python3 - "$DIR/index.html" > "$OUT/_plan.txt" <<'PY'
import sys, re, io
s = io.open(sys.argv[1], encoding='utf-8').read()
for n, m in enumerate(re.finditer(r'data-steps="(\d+)" data-id="([A-Z])"', s), 1):
    steps, sid = int(m.group(1)), m.group(2)
    for st in range(0, steps + 1):
        print(n, st, sid)
PY

while read -r n st sid; do
  "$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,1080 \
        --virtual-time-budget=3500 --screenshot="$OUT/${sid}-$st.png" \
        "file://$DIR/_still.html?s=$n&step=$st&theme=$THEME" >/dev/null 2>&1
done < "$OUT/_plan.txt"

rm -f "$DIR/_still.html" "$OUT/_plan.txt"
echo "stills -> $OUT"
ls "$OUT" | wc -l
