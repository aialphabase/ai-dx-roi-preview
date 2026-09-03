#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""アセットクラス強弱マップ 夜間自動更新（平日23:00 JST / GitHub Actions）

MODE（環境変数 ASSET_MAP_MODE）:
  dry  : 取得・検証・ドラフト生成のみ。本番へは一切触れない（既定）
  live : 検証合格時のみ /17/ へFTPアップロード＋Discord Webhook投稿

設計原則:
  - 人が書いた欄（TODAY'S PICK / learn / quiz / imp / shape）は絶対に上書きしない
  - 自動が書くのは mark / cls / c / state と history の1行だけ
  - 検証に落ちた日は「更新しない」。落ちた事実を通知する
"""
import json, os, sys, urllib.request, urllib.parse, datetime, traceback

MODE = os.environ.get("ASSET_MAP_MODE", "dry").lower()
UA = "Mozilla/5.0 (compatible; mirai-asset-map-bot/1.0)"
JST = datetime.timezone(datetime.timedelta(hours=9))
NOW = datetime.datetime.now(JST)
TODAY = NOW.strftime("%Y-%m-%d")
OUT = os.path.join(os.path.dirname(__file__), "..", "automation", "out")
PROD_DATA = "https://aihukugyou.info/17/asset-data.json"
PROD_HIST = "https://aihukugyou.info/17/asset-history.json"

# マップ7資産 ← Yahooシンボル。max_move=前日比の異常閾値(%)
ASSETS = [
    ("ゴールド",              "GC=F",    10.0),
    ("米株指数(ナスダック100)", "^NDX",     8.0),
    ("米金利",                "^TNX",    12.0),
    ("ドル(DXY)",             "JPY=X",    4.0),
    ("原油",                  "CL=F",    12.0),
    ("BTC",                   "BTC-USD", 20.0),
    ("アルトコイン",           "ETH-USD", 25.0),
]
SHORT = {"米株指数(ナスダック100)":"株指数","ドル(DXY)":"ドル","アルトコイン":"アルト"}
MARK_STYLE = {"◎":("m-s","#46e8aa"),"○":("m-a","#42ddff"),"△":("m-b","#f4c66b"),"▼":("m-c","#ff7b83")}

def fetch(sym):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           + urllib.parse.quote(sym) + "?interval=1d&range=1mo")
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    d = json.load(urllib.request.urlopen(req, timeout=30))["chart"]["result"][0]
    cl = [c for c in d["indicators"]["quote"][0]["close"] if c is not None]
    ts = [t for t in d["timestamp"]][-1]
    last_day = datetime.datetime.fromtimestamp(ts, JST).date()
    if len(cl) < 6: raise ValueError("終値データ不足")
    ma20 = sum(cl[-20:]) / len(cl[-20:])
    return {"price": cl[-1], "prev": cl[-2],
            "chg": (cl[-1]-cl[-2])/cl[-2]*100,
            "wk": (cl[-1]-cl[-6])/cl[-6]*100,
            "above_ma20": cl[-1] > ma20,
            "stale_days": (NOW.date() - last_day).days}

def suggest_mark(m):
    s = 0
    s += 1 if m["above_ma20"] else 0
    s += 2 if m["wk"] > 2 else 1 if m["wk"] > 0 else -2 if m["wk"] < -3 else -1
    s += 1 if m["chg"] > 1 else -1 if m["chg"] < -1 else 0
    return "◎" if s >= 3 else "○" if s >= 1 else "△" if s >= -1 else "▼"

def state_text(name, m):
    p, c = m["price"], m["chg"]
    if name == "ゴールド":   return f"{p:,.0f}ドル台（前日比{c:+.1f}%）。20日線の{'上' if m['above_ma20'] else '下'}"
    if name.startswith("米株指数"): return f"ナスダック100 {p:,.0f}pt（{c:+.2f}%）。週間{m['wk']:+.1f}%"
    if name == "米金利":     return f"10年債利回り{p:.2f}%（前日{p-m['prev']:+.2f}pt）"
    if name == "ドル(DXY)":  return f"ドル円{p:.2f}円（{c:+.2f}%）"
    if name == "原油":       return f"WTI {p:.2f}ドル（{c:+.1f}%）"
    if name == "BTC":        return f"{p:,.0f}ドル（{c:+.1f}%）"
    return f"ETH {p:,.0f}ドル（{c:+.1f}%）。BTCとの強弱差を確認"

def main():
    os.makedirs(OUT, exist_ok=True)
    report = [f"# 夜間更新レポート {NOW.strftime('%Y-%m-%d %H:%M JST')}", f"MODE: {MODE}", ""]
    errors, warns = [], []

    if NOW.weekday() >= 5:
        report.append("土日のためスキップ")
        write_report(report); return

    # 1) 取得＋検証
    data = {}
    for name, sym, max_move in ASSETS:
        try:
            m = fetch(sym)
            if abs(m["chg"]) > max_move:
                errors.append(f"{name}: 前日比{m['chg']:+.1f}%が閾値±{max_move}%超（データ異常の疑い）")
            if m["stale_days"] > 4:
                warns.append(f"{name}: 最終データが{m['stale_days']}日前（休場明け等は正常）")
            data[name] = m
        except Exception as e:
            errors.append(f"{name}: 取得失敗 {e}")

    # 2) 本番JSONを取得（人の編集を土台にする）
    try:
        req = urllib.request.Request(PROD_DATA + f"?v={int(NOW.timestamp())}", headers={"User-Agent": UA})
        prod = json.load(urllib.request.urlopen(req, timeout=30))
        req = urllib.request.Request(PROD_HIST + f"?v={int(NOW.timestamp())}", headers={"User-Agent": UA})
        hist = json.load(urllib.request.urlopen(req, timeout=30))
    except Exception as e:
        errors.append(f"本番JSON取得失敗: {e}")
        prod, hist = None, None

    ok = not errors and prod is not None
    report.append("## 検証結果: " + ("✅ 合格" if ok else "❌ 不合格（更新中止）"))
    for e in errors: report.append(f"- ❌ {e}")
    for w in warns:  report.append(f"- ⚠ {w}")
    report.append("")

    if prod is not None and data:
        # 3) ドラフト生成（mark/cls/c/state のみ差し替え。manual:true の資産は触らない）
        draft = json.loads(json.dumps(prod, ensure_ascii=False))
        draft["updated"] = TODAY
        marks = {}
        report.append("## 判定")
        report.append("| 資産 | 現在値 | 前日比 | 週間 | 判定 | 備考 |")
        report.append("|---|---|---|---|---|---|")
        for a in draft.get("assets", []):
            name = a["name"]
            if name not in data: continue
            m = data[name]; mk = suggest_mark(m)
            note = "manual指定・据え置き" if a.get("manual") else ""
            if not a.get("manual"):
                a["mark"] = mk
                a["cls"], a["c"] = MARK_STYLE[mk]
                a["state"] = state_text(name, m)
            marks[SHORT.get(name, name)] = a["mark"]
            report.append(f"| {name} | {m['price']:,.2f} | {m['chg']:+.2f}% | {m['wk']:+.2f}% | {a['mark']} | {note} |")
        report.append("")
        report.append("※ shape / TODAY'S PICK / learn / 今週の1問 は人の編集領域のため未変更")

        # 4) history ドラフト（当日行を追記 or 置換）
        hist_d = [h for h in (hist or []) if h.get("date") != TODAY]
        hist_d.append({"date": TODAY, "shapeRead": draft.get("shapeRead",""),
                       "marks": marks, "pickTitle": (draft.get("news") or {}).get("title","")})
        hist_d.sort(key=lambda h: h["date"])

        json.dump(draft, open(os.path.join(OUT,"asset-data.draft.json"),"w"), ensure_ascii=False, indent=1)
        json.dump(hist_d, open(os.path.join(OUT,"asset-history.draft.json"),"w"), ensure_ascii=False, indent=1)

        # 5) live: 合格時のみアップロード＋Discord投稿
        if MODE == "live" and ok:
            try:
                upload_ftp(os.path.join(OUT,"asset-data.draft.json"), "asset-data.json")
                upload_ftp(os.path.join(OUT,"asset-history.draft.json"), "asset-history.json")
                report.append("\n## live: FTPアップロード完了")
                post_discord(draft, marks)
                report.append("## live: Discord投稿完了")
            except Exception as e:
                report.append(f"\n## live: ❌ 失敗 {e}")
                notify_ops(f"⚠ マップ自動更新の反映に失敗: {e}")
        elif MODE == "live" and not ok:
            notify_ops("⚠ 本日のマップ自動更新は検証不合格のため中止しました。レポートを確認してください。")
    write_report(report)

def upload_ftp(local, remote):
    from ftplib import FTP_TLS
    host, user, pw = os.environ["FTP_HOST"], os.environ["FTP_USER"], os.environ["FTP_PASS"]
    rdir = os.environ.get("FTP_REMOTE_DIR", "/aihukugyou.info/public_html/17")
    ftp = FTP_TLS(host, timeout=60); ftp.login(user, pw); ftp.prot_p(); ftp.cwd(rdir)
    with open(local, "rb") as f: ftp.storbinary(f"STOR {remote}", f)
    ftp.quit()

def post_discord(draft, marks):
    url = os.environ.get("DISCORD_WEBHOOK_URL")
    if not url: return
    line = "　".join(f"{k}{v}" for k, v in marks.items())
    body = {"username": "アセットマップ",
            "content": (f"🗺 **今日の市場マップ**（{TODAY} 23時更新）\n"
                        f"{draft.get('shapeRead','')}\n{line}\n"
                        "https://aihukugyou.info/17/asset-map.html")}
    req = urllib.request.Request(url, json.dumps(body).encode(), {"Content-Type":"application/json","User-Agent":UA})
    urllib.request.urlopen(req, timeout=30)

def notify_ops(msg):
    url = os.environ.get("DISCORD_OPS_WEBHOOK_URL")
    if not url: return
    try:
        req = urllib.request.Request(url, json.dumps({"content": msg}).encode(),
                                     {"Content-Type":"application/json","User-Agent":UA})
        urllib.request.urlopen(req, timeout=30)
    except Exception: pass

def write_report(lines):
    txt = "\n".join(lines) + "\n"
    open(os.path.join(OUT, "report.md"), "w").write(txt)
    print(txt)
    s = os.environ.get("GITHUB_STEP_SUMMARY")
    if s: open(s, "a").write(txt)

if __name__ == "__main__":
    try: main()
    except Exception:
        traceback.print_exc()
        write_report([f"# 夜間更新 {TODAY}", "❌ 予期しないエラー", "```", traceback.format_exc(), "```"])
