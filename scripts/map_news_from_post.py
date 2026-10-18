#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""平日のテラ君投稿（本番に出した本文）の①を、強弱マップの「今日知るべきニュース」に写す。

使い方: python3 scripts/map_news_from_post.py <YYYY-MM-DD_曜_通常配信_投稿本文.txt> [--dry]
  - 平日（月〜金）のファイルだけ扱う。土日は何もしない（日曜はミライニュースの1本目に替える＝check_map_weekly.py）
  - 書き換えるのは news だけ。今の形（shapeRead）と今週の1問（question）は日曜だけ
  - --dry を付けると、書き換えずに中身を表示するだけ
post_prod_news.sh が本番投稿に成功したあとに呼ぶ（2026-10-18〜）。
"""
import json, os, re, sys, datetime

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DATA = os.path.join(ROOT, "automation", "out", "asset-data.json")
NEWS_ROOM = "https://discord.com/channels/1457647873679298705/1465604900984455302"
# ①の文に出てくる言葉 → 「市場の定点観測」の行の頭
ASSETS = [
    (r"日経", "日経平均"), (r"ダウ", "NYダウ"), (r"ドル円|円安|円高", "ドル円"),
    (r"金利|利回り", "米10年債利回り"), (r"ゴールド|金価格", "ゴールド"), (r"原油", "WTI原油"),
    (r"ビットコイン|仮想資産|暗号資産|BTC", "ビットコイン"),
]
SHORT = {"日経平均株価": "日経", "日経平均": "日経", "米10年債利回り": "米10年金利", "WTI原油": "原油"}

def clean(s):
    return re.sub(r"[\U0001F300-\U0001FAFF☀-➿️]", "", s).strip()

def parse(text):
    sec = re.search(r"^①(.+?)$(.*?)^②", text, re.S | re.M)
    if not sec:
        raise ValueError("①〜②の段落が見つかりません")
    head = clean(sec.group(1))
    body = sec.group(2)
    gai = re.search(r"・概要[:：]\s*(.+)", body)
    kan = re.search(r"・私たちへの関係[:：]\s*(.+)", body)
    if not gai:
        raise ValueError("①の「・概要:」が見つかりません")
    # 市場の定点観測の行
    obs = {}
    for line in text.splitlines():
        m = re.match(r"^・([^:：]+)[:：]\s*(.+)$", line.strip())
        if m and not m.group(1).startswith(("概要", "私たちへの関係")):
            obs[m.group(1).strip()] = clean(m.group(2))
    return head, gai.group(1).strip(), (kan.group(1).strip() if kan else ""), obs

def chip(name, val):
    label = SHORT.get(name, name)
    num = re.match(r"([0-9][0-9,\.]*\s*(?:円|ドル|%|pt)?)", val)
    pct = re.search(r"([+\-−]\d+(?:\.\d+)?%)", val)
    move = "低下" if "低下" in val else ("上昇" if "上昇" in val else "")
    txt = label + " " + (num.group(1) if num else val[:12])
    if pct: txt += "（" + pct.group(1) + "）"
    elif move: txt += "（" + move + "）"
    sign = (pct.group(1)[0] if pct else ("+" if move == "上昇" else ("-" if move == "低下" else "")))
    cls = "c-green" if sign == "+" else ("c-red" if sign in "-−" and sign else "c-cyan")
    if label == "米10年金利": cls = "c-cyan"
    return [txt, cls]

def build(path):
    base = os.path.basename(path)
    m = re.match(r"^(\d{4}-\d{2}-\d{2})_", base)
    if not m or "_通常配信_投稿本文" not in base:
        raise ValueError("平日の通常配信の本文ファイルではありません: " + base)
    date = m.group(1)
    if datetime.date.fromisoformat(date).weekday() >= 5:
        return None, date
    head, gai, kan, obs = parse(open(path, encoding="utf-8").read())
    seen, chain = [], []
    target = head + gai
    hits = sorted(((re.search(pat, target).start(), key) for pat, key in ASSETS if re.search(pat, target)))
    for _, key in hits:
        name = next((k for k in obs if k.startswith(key)), None)
        if name and name not in seen:
            seen.append(name)
            chain.append(chip(name, obs[name]))
    md = f"{int(date[5:7])}/{int(date[8:10])}"
    news = {
        "date": date,
        "title": head,
        "summary": gai,
        "chain": chain[:4],
        "learn": "💡 私たちへの関係: " + kan if kan else "💡 マップの球を押すと、その資産の今の状態が見られます。",
        "src": f"テラ君の平日ニュース（Discord ニュース速報 {md} 14時時点）・公開市場データ(Yahoo Finance)",
        "url": NEWS_ROOM,
        "via": "daily",
    }
    return news, date

def main():
    if len(sys.argv) < 2:
        print(__doc__); return 2
    path, dry = sys.argv[1], "--dry" in sys.argv
    news, date = build(path)
    if news is None:
        print(f"{date} は土日なので、ニュース欄は更新しません"); return 0
    if dry:
        print(json.dumps(news, ensure_ascii=False, indent=1)); return 0
    d = json.load(open(DATA, encoding="utf-8"))
    d["news"] = news
    open(DATA, "w", encoding="utf-8").write(json.dumps(d, ensure_ascii=False, indent=1) + "\n")
    print(f"ニュース欄を {date} の①に更新: {news['title']}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
