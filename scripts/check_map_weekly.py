#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""強弱マップの「人が書く欄」が今週分になっているかを確かめる（日曜のミライニュース公開前に実行）。

使い方: python3 scripts/check_map_weekly.py 2026-W44
  - asset-data.json の weekly.week が指定の週と一致しなければ 1 で終わる（公開スクリプトはここで止める）
  - 差し替える3つ: news（今日知るべきニュース＝その回の1本目）／shapeRead（今の形＝ストーリーボードの shape）／question（今週の1問＝Discordアンケート）
  - 3つを直したら weekly を {"week": 週, "episode": "第◯回", "updated": 日付} にしてコミットする
背景: 10/11（第30回・第7話）でこの差し替えが抜け、ニュース欄が10/2のまま16日止まった。
"""
import json, os, sys

def main():
    if len(sys.argv) < 2:
        print("使い方: check_map_weekly.py <週 例 2026-W44>"); return 2
    week = sys.argv[1]
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "automation", "out", "asset-data.json")
    d = json.load(open(p, encoding="utf-8"))
    w = d.get("weekly") or {}
    news = d.get("news") or {}
    print("weekly   :", w)
    print("news     :", news.get("date"), "|", (news.get("title") or "")[:60])
    print("shapeRead:", (d.get("shapeRead") or "")[:60])
    print("question :", ((d.get("question") or {}).get("text") or "")[:60])
    if w.get("week") != week:
        print(f"NG: 強弱マップが今週分（{week}）になっていません。news・shapeRead・question を差し替えて weekly.week を {week} にしてください。")
        return 1
    print(f"OK: 強弱マップは {week} 分です。")
    return 0

if __name__ == "__main__":
    sys.exit(main())
