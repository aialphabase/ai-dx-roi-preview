#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""日曜の本番公開（publish_m<回>.sh の毎週の書き換えをやめた版）。Mac・GitHub Actions・クラウドセッションのどこでも同じに動く。

使い方（リポジトリの一番上で）:
  python3 scripts/mirai_publish.py --spec projects/mirai-ops/publish/2026-W45.json --target test --go
  --target test : テスト部屋へ「本文＋アンケート」を出すだけ。links.json・push・強弱マップの確認はしない
  --target prod : 強弱マップの確認 → links.json に m<回>full・m<回>sb → push → Pages反映 → 本番 #ニュース速報 へ
  --go が無ければ、やることを表示するだけ
  Webhook は環境変数 DISCORD_WEBHOOK_URL（Actions では target に合わせてシークレットから入る）か --hook-file
spec（json）: {"ep": 33, "week": "2026-W45", "full_url": "…", "deadline": "2026-11-04 20:00",
               "body": "告知本文", "question": "問い", "answers": ["A …", "B …", "C …"]}  ※ TODO が残っていたら止まる
GitHub のボタン: Actions → mirai-publish → Run workflow（スマホの GitHub アプリからも押せる）
"""
import argparse, datetime as dt, json, os, subprocess, sys, time, urllib.request

JST = dt.timezone(dt.timedelta(hours=9))
PAGES = "https://aialphabase.github.io/ai-dx-roi-preview/projects/mirai/go/links.json"
UA = {"User-Agent": "MiraiNewsBot/1.0"}

def sh(*a): print("+", " ".join(a)); subprocess.run(a, check=True)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--spec", required=True); ap.add_argument("--target", choices=["test", "prod"], default="test")
    ap.add_argument("--hook-file"); ap.add_argument("--go", action="store_true")
    a = ap.parse_args()
    sp = json.load(open(a.spec, encoding="utf-8"))
    body, q, answers = sp["body"].strip(), sp["question"], sp["answers"]
    if "TODO" in body or "TODO" in q or any("TODO" in x for x in answers):
        sys.exit("本文・問い・A/B/C に TODO が残っています（差し替えてから）")
    end = dt.datetime.strptime(sp["deadline"], "%Y-%m-%d %H:%M").replace(tzinfo=JST)
    hours = 1 if a.target == "test" else max(1, int((end - dt.datetime.now(JST)).total_seconds() // 3600))
    full, sb = f"m{sp['ep']}full", f"m{sp['ep']}sb"
    sb_url = f"https://aialphabase.github.io/ai-dx-roi-preview/projects/mirai/brief/?week={sp['week']}&m=mirai2609&src=discord"
    print(f"行き先: {'テスト部屋' if a.target == 'test' else '本番 #ニュース速報'}\n"
          f"links.json: {full} = {sp['full_url']} / {sb} = {sb_url}{'（テストでは書かない）' if a.target == 'test' else ''}\n"
          f"アンケート: {q} {answers}（{hours}時間・締切 {sp['deadline']}）\n本文 {len(body)}文字")
    if a.target == "prod":
        if subprocess.run([sys.executable, "scripts/check_map_weekly.py", sp["week"]]).returncode != 0:
            sys.exit("強弱マップが今週分ではありません。公開は中止")
    if not a.go:
        print("（表示のみ。--go で実行）"); return
    hook = os.environ.get("DISCORD_WEBHOOK_URL") or (a.hook_file and open(a.hook_file).read().strip())
    if not hook:
        sys.exit("Webhook がありません（DISCORD_WEBHOOK_URL か --hook-file）")
    if a.target == "prod":
        p = "projects/mirai/go/links.json"; L = json.load(open(p, encoding="utf-8")); L[full] = sp["full_url"]; L[sb] = sb_url
        json.dump(L, open(p, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
        sh("git", "add", "automation/out/asset-data.json", p, "projects/mirai/brief/index.html",
           f"projects/mirai/brief/data/{sp['week']}.json", "projects/mirai/brief/data/index.json")
        sh("git", "commit", "-q", "-m", f"mirai: 第{sp['ep']}回 完全版 go/{full}・{sp['week']} go/{sb}")
        sh("git", "pull", "-q", "--rebase"); sh("git", "push", "-q", "origin", "HEAD")
        for i in range(12):
            time.sleep(20)
            if full in urllib.request.urlopen(urllib.request.Request(PAGES + f"?t={time.time()}", headers=UA)).read().decode():
                print(f"Pages反映 ({i + 1})"); break
        else:
            sys.exit("Pages未反映。投稿は中止")
    emoji = ["🅰️", "🅱️", "🇨"]
    payload = {"content": body, "poll": {"question": {"text": q},
               "answers": [{"poll_media": {"text": t, "emoji": {"name": e}}} for t, e in zip(answers, emoji)],
               "duration": hours, "allow_multiselect": False, "layout_type": 1}}
    req = urllib.request.Request(hook + "?wait=true", data=json.dumps(payload).encode(), headers={**UA, "Content-Type": "application/json"})
    r = json.load(urllib.request.urlopen(req))
    print(f"{dt.datetime.now(JST):%Y-%m-%d %H:%M} {a.target} 投稿 message_id={r.get('id')} poll={bool(r.get('poll'))}")

if __name__ == "__main__":
    main()
