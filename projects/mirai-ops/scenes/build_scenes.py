# -*- coding: utf-8 -*-
"""
ミライニュースの収録用シーンを1枚のHTMLに組む。

使い方:  python3 build_scenes.py 27
入力:    scenes/ep<番号>.json（台本の「画面」欄をそのまま写したもの。正本）
出力:    scenes/ep<番号>/index.html

・内部は1440×810で組み、表示は viewport に合わせて拡大する（1920×1080 なら 1.3333倍）。
・右矢印で「次の状態 → 次のシーン」と進む。左矢印で戻る。
・収録用にUIは既定で非表示。u でページャ、i で尺の目安、f で全画面。
・?s=3 でそのシーンから、?full=1 で全状態を出した静止状態（書き出し確認用）。
"""
import json, sys, html
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EP = sys.argv[1] if len(sys.argv) > 1 else '27'
data = json.loads((ROOT / f'ep{EP}.json').read_text(encoding='utf-8'))
meta, scenes = data['meta'], data['scenes']
E = html.escape

CSS = '''
*{box-sizing:border-box}
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#05080f}
body{font-family:"Hiragino Mincho ProN","Yu Mincho",serif;color:#f4f2e9}
#stage{position:absolute;left:50%;top:50%;width:1440px;height:810px;
 transform:translate(-50%,-50%) scale(var(--scale,1));transform-origin:center;
 background:radial-gradient(120% 90% at 78% 10%,#122240 0%,#0a1223 42%,#060b16 100%);overflow:hidden}
.scene{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;
 padding:70px 80px;opacity:0;transition:opacity .8s ease;pointer-events:none}
.scene.on{opacity:1;pointer-events:auto}
h2.t{font-size:44px;line-height:1.35;margin:0 0 30px;letter-spacing:.02em;text-align:center}
h2.t em{font-style:normal;color:#eac77e}
.sub{font:20px/1.6 "Hiragino Sans",sans-serif;color:#9fb0c6;margin:-16px 0 26px}
.foot{position:absolute;left:80px;right:80px;bottom:56px;text-align:center;font-size:27px;color:#e7e3d6}
.foot b{color:#eac77e}
.st{opacity:0;transform:translateY(16px);transition:opacity .7s ease,transform .7s cubic-bezier(.2,.8,.3,1)}
.st.in{opacity:1;transform:none}

/* A 記事カード2枚 */
.two{display:grid;grid-template-columns:1fr 1fr;gap:34px;width:1220px}
.two article{background:linear-gradient(160deg,#16243f,#101a2e);border:1px solid #33425c;border-top:3px solid #eac77e;
 border-radius:16px;padding:34px 34px 30px;min-height:250px;display:flex;flex-direction:column}
.two small{font:16px/1 "Hiragino Sans",sans-serif;letter-spacing:.16em;color:#8bbdb9}
.two h3{font-size:29px;line-height:1.5;margin:16px 0 auto}
.two .m{font:16px "Hiragino Sans",sans-serif;color:#8d9bb0;margin-top:22px}

/* B/E 見出しカード */
.head-card{width:1180px;background:linear-gradient(150deg,#17263f,#0f1a2d);border:1px solid #3a4862;border-radius:18px;
 padding:56px 60px;position:relative}
.head-card .src{font:17px "Hiragino Sans",sans-serif;letter-spacing:.2em;color:#8bbdb9;margin-bottom:26px}
.head-card h1{font-size:52px;line-height:1.5;margin:0}
.head-card .by{font:18px "Hiragino Sans",sans-serif;color:#8d9bb0;margin-top:30px}
.head-card .tag{position:absolute;right:52px;top:48px;background:#eac77e;color:#20190c;border-radius:8px;
 font:700 21px "Hiragino Sans",sans-serif;padding:10px 20px}

/* C 横バー */
.bars{width:1180px;display:flex;flex-direction:column;gap:30px}
.bar{display:grid;grid-template-columns:230px 1fr;align-items:center;gap:26px}
.bar .lb{font:20px "Hiragino Sans",sans-serif;color:#b8c4d5;text-align:right}
.bar .track{position:relative;height:66px;background:#101b31;border:1px solid #2b3850;border-radius:10px}
.bar .fill{position:absolute;left:0;top:0;bottom:0;width:0;border-radius:9px;
 background:linear-gradient(90deg,#3d5c7a,#6f92b5);transition:width 1s cubic-bezier(.25,.9,.3,1)}
.bar.accent .fill{background:linear-gradient(90deg,#8a6f34,#eac77e)}
.bar.in .fill{width:var(--w)}
.bar .val{position:absolute;left:24px;top:0;height:66px;display:flex;align-items:center;gap:16px;
 font-size:30px;color:#fdfbf4;opacity:0;transition:opacity .5s ease .45s}
.bar.in .val{opacity:1}
.bar .val i{font-style:normal;font:17px "Hiragino Sans",sans-serif;color:#cfd8e6}
.badge{margin:34px auto 0;background:#eac77e;color:#20190c;font:700 30px "Hiragino Sans",sans-serif;
 padding:12px 30px;border-radius:10px}

/* D 対比表 */
table.cmp{width:1180px;border-collapse:collapse;font-size:27px}
table.cmp th{font:17px "Hiragino Sans",sans-serif;letter-spacing:.14em;color:#b8c4d5;padding:0 22px 18px;text-align:left}
table.cmp th.c{color:#eac77e;font-size:24px;letter-spacing:.04em}
table.cmp td{border-top:1px solid #2b3850;padding:26px 22px;color:#eef0f4}
table.cmp td.h{font:19px "Hiragino Sans",sans-serif;color:#9fb0c6;width:220px}
table.cmp td.mark{position:relative;color:#eac77e}
table.cmp td.mark:after{content:'';position:absolute;left:8px;right:8px;top:8px;bottom:8px;border:1px solid #eac77e60;
 border-radius:10px;background:#eac77e12;opacity:0;transition:opacity .6s ease}
table.cmp tr.in td.mark:after{opacity:1}

/* F 2本のライン */
.levels{width:1180px;position:relative;height:420px;border-left:1px solid #2b3850}
.lvl{position:absolute;left:0;right:0;display:flex;align-items:center;gap:22px}
.lvl:before{content:'';flex:1;height:2px;border-radius:2px;background:currentColor}
.lvl .txt{font:20px "Hiragino Sans",sans-serif;color:#b8c4d5;white-space:nowrap}
.lvl .txt b{display:block;font:40px "Hiragino Mincho ProN",serif;margin-top:6px}
.lvl.gold .txt b{color:#eac77e}.lvl.red .txt b{color:#d98a8a}
.lvl.gold{color:#eac77e;top:110px}
.lvl.red{color:#d98a8a;top:320px}
.chip{position:absolute;left:0;top:-6px;background:#16243f;border:1px solid #3a4862;border-radius:999px;
 font:19px "Hiragino Sans",sans-serif;color:#cfd8e6;padding:10px 22px}

/* G 折れ線 */
.chart-wrap{display:grid;grid-template-columns:880px 340px;gap:40px;width:1260px;align-items:center}
.chart-box{position:relative;width:880px;height:440px}
svg.chart{position:absolute;left:0;top:0;width:880px;height:440px;overflow:visible}
.clbl{position:absolute;font-family:"Hiragino Sans",sans-serif;white-space:nowrap;line-height:1.3}
.clbl.big{font-size:31px;color:#f4f2e9;letter-spacing:.01em}
.clbl.note{font-size:18px;color:#9fb0c6}
.clbl.ref{font-size:19px;color:#8bbdb9}
.clbl.tick{font-size:18px;color:#9fb0c6;transform:translateX(-50%)}
.clbl.ev{font-size:18px;color:#b8c4d5;transform:translateX(-50%)}
.clbl.r{transform:translateX(-100%)}
.clbl.r.st{transform:translateX(-100%) translateY(16px)}
.clbl.r.st.in{transform:translateX(-100%)}
.clbl.tick.st{transform:translateX(-50%) translateY(16px)}
.clbl.tick.st.in{transform:translateX(-50%)}
svg.chart .axis{stroke:#2b3850;stroke-width:1}
svg.chart .ref{stroke:#8bbdb9;stroke-width:2;stroke-dasharray:8 8}
svg.chart .line{fill:none;stroke:#eac77e;stroke-width:4;stroke-linecap:round;stroke-linejoin:round;
 stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 1.8s cubic-bezier(.4,.1,.3,1)}
svg.chart .line.in{stroke-dashoffset:0}
svg.chart text{font-family:"Hiragino Sans",sans-serif;fill:#cfd8e6}
.side{display:flex;flex-direction:column;gap:22px}
.side div{background:#12203a;border:1px solid #33425c;border-left:3px solid #8bbdb9;border-radius:12px;padding:22px 24px}
.side small{font:16px "Hiragino Sans",sans-serif;letter-spacing:.1em;color:#9fb0c6}
.side b{display:block;font-size:32px;color:#eac77e;margin:8px 0 6px}
.side p{margin:0;font:16px/1.6 "Hiragino Sans",sans-serif;color:#b8c4d5}

/* H タイトル板＋政策金利カード */
.board{width:1240px;text-align:center;font-size:50px;line-height:1.45;margin-bottom:44px}
.board em{font-style:normal;color:#eac77e}
.rate-cards{display:grid;grid-template-columns:1fr 1fr;gap:34px;width:1180px}
.rate-cards article{background:#12203a;border:1px solid #33425c;border-radius:16px;padding:30px 34px}
.rate-cards small{font:17px "Hiragino Sans",sans-serif;letter-spacing:.1em;color:#8bbdb9}
.rate-cards b{display:block;font-size:56px;color:#eac77e;margin:10px 0 14px}
.rate-cards li{font:19px/1.8 "Hiragino Sans",sans-serif;color:#cfd8e6;list-style:none}
.rate-cards ul{margin:0;padding:0}

/* I 動いたもの／動かなかったもの */
.blocks{display:grid;grid-template-columns:1fr 1fr;gap:34px;width:1220px}
.blk{background:#101b31;border:1px solid #2f3d55;border-radius:16px;padding:26px 30px}
.blk .day{font:19px "Hiragino Sans",sans-serif;letter-spacing:.08em;color:#8bbdb9;margin-bottom:18px}
.row{display:flex;align-items:baseline;justify-content:space-between;gap:20px;padding:14px 0;border-top:1px solid #253149}
.row:first-of-type{border-top:0}
.row .n{font:20px "Hiragino Sans",sans-serif;color:#b8c4d5}
.row .v{font-size:38px}
.row.up .v{color:#8bbdb9}.row.down .v{color:#d98a8a}
.row.mark{background:#eac77e12;border-radius:10px;padding:14px 16px;margin-top:8px}
.row.mark .v{color:#eac77e}
.blk .note{font:17px/1.6 "Hiragino Sans",sans-serif;color:#9fb0c6;margin-top:10px}
.band{width:1220px;margin-top:30px;display:flex;align-items:center;gap:24px;background:#12203a;border:1px solid #33425c;
 border-radius:14px;padding:22px 30px;font:22px "Hiragino Sans",sans-serif;color:#cfd8e6}
.band .g{font:700 30px "Hiragino Sans",sans-serif;color:#eac77e;padding:0 10px}
.band .nt{margin-left:auto;font-size:18px;color:#9fb0c6}

/* J ABC */
.abc-wrap{display:grid;grid-template-columns:270px 1fr;gap:38px;width:1260px;align-items:start}
.aside{background:#101b31;border:1px solid #2f3d55;border-radius:14px;padding:24px 26px}
.aside h4{margin:0 0 14px;font:18px "Hiragino Sans",sans-serif;letter-spacing:.12em;color:#8bbdb9}
.aside li{list-style:none;font:19px/2 "Hiragino Sans",sans-serif;color:#cfd8e6}
.aside ul{margin:0;padding:0}
.aside .nt{font:16px/1.6 "Hiragino Sans",sans-serif;color:#8d9bb0;margin-top:14px}
.abc{display:flex;flex-direction:column;gap:20px}
.abc article{position:relative;display:grid;grid-template-columns:70px 1fr 300px;align-items:center;gap:24px;background:#12203a;
 border:1px solid #33425c;border-radius:14px;padding:22px 26px}
.abc .tag{width:56px;height:56px;border-radius:50%;background:#1d2c49;border:1px solid #44536e;color:#cfd8e6;
 display:flex;align-items:center;justify-content:center;font:700 28px "Hiragino Sans",sans-serif}
.abc h3{margin:0 0 8px;font-size:30px}
.abc li{list-style:none;font:19px/1.7 "Hiragino Sans",sans-serif;color:#cfd8e6}
.abc ul{margin:0;padding:0}
.abc .cond{font:18px/1.6 "Hiragino Sans",sans-serif;color:#9fb0c6;text-align:right}
.abc article.best{border-color:#eac77e;background:linear-gradient(120deg,#1d2b1a00,#eac77e12)}
.abc article.best .tag{background:#eac77e;color:#20190c;border-color:#eac77e}
.abc article.best h3{color:#eac77e}
.abc .best-chip{position:absolute;top:-15px;right:26px;background:#eac77e;color:#20190c;
 font:700 17px "Hiragino Sans",sans-serif;border-radius:6px;padding:5px 14px;letter-spacing:.06em}

/* K 3つの数字 */
.three{display:grid;grid-template-columns:repeat(3,1fr);gap:30px;width:1220px}
.three article{background:#12203a;border:1px solid #33425c;border-top:3px solid #8bbdb9;border-radius:16px;
 padding:34px 30px;text-align:center}
.three small{font:16px "Hiragino Sans",sans-serif;letter-spacing:.2em;color:#8bbdb9}
.three h3{margin:14px 0 6px;font-size:26px;color:#cfd8e6}
.three b{display:block;font-size:52px;color:#eac77e}
.three p{margin:10px 0 0;font:18px "Hiragino Sans",sans-serif;color:#9fb0c6}

/* 収録用UI（既定は非表示） */
#ui{position:absolute;right:26px;bottom:20px;display:flex;align-items:center;gap:10px;
 font:15px "Hiragino Sans",sans-serif;color:#9fb0c6;z-index:9}
body.ui #ui,body.ui #index{display:none}
#index{position:absolute;left:0;right:0;top:16px;display:flex;justify-content:center;gap:6px;z-index:9}
#index button{border:1px solid #2f3d55;background:#0c1323cc;color:#8d9bb0;border-radius:8px;
 font:14px "Hiragino Sans",sans-serif;padding:6px 11px;cursor:pointer}
#index button.active{border-color:#eac77e;background:#eac77e;color:#20190c;font-weight:700}
:fullscreen #ui,:fullscreen #index{display:none}
#hint{position:absolute;left:26px;bottom:22px;font:14px "Hiragino Sans",sans-serif;color:#6b7a91;z-index:9}
:fullscreen #hint,body.ui #hint{display:none}
#ui button{border:1px solid #344051;background:#0c1323d9;color:#eac77e;font-size:19px;width:38px;height:38px;border-radius:50%}
#info{position:absolute;left:26px;bottom:20px;display:none;font:15px/1.7 "Hiragino Sans",sans-serif;color:#9fb0c6;
 background:#0c1323d9;border:1px solid #344051;border-radius:10px;padding:10px 16px;z-index:9;text-align:left}
body.info #info{display:block}
@media(prefers-reduced-motion:reduce){.st,.bar .fill,svg.chart .line{transition:none}}
'''


def li(items):
    return '<ul>' + ''.join(f'<li>{x}</li>' for x in items) + '</ul>'


def build(sc):
    k = sc['kind']
    t = f'<h2 class="t">{sc["title"]}</h2>' if sc.get('title') else ''
    steps = 0
    body = ''

    if k == 'cards2':
        cards = ''.join(
            f'<article><small>{E(c["kicker"])}</small><h3>{c["title"]}</h3><div class="m">{E(c["meta"])}</div></article>'
            for c in sc['cards'])
        body = t + f'<div class="two">{cards}</div>'
        if sc.get('foot'):
            body += f'<div class="foot"><b>{sc["foot"]}</b></div>'

    elif k == 'headline':
        tag = f'<div class="tag">{E(sc["tag"])}</div>' if sc.get('tag') else ''
        body = (f'<div class="head-card">{tag}<div class="src">{E(sc["source"])}</div>'
                f'<h1>{sc["headline"]}</h1><div class="by">{E(sc["byline"])}</div></div>')

    elif k == 'bars':
        mx = max(b['value'] for b in sc['bars'])
        rows = ''
        for i, b in enumerate(sc['bars'], 1):
            w = round(b['value'] / mx * 100, 1)
            rows += (f'<div class="bar st{" accent" if b.get("accent") else ""}" data-step="{i}" style="--w:{w}%">'
                     f'<div class="lb">{E(b["label"])}</div><div class="track"><div class="fill"></div>'
                     f'<div class="val">{E(b["main"])}<i>{E(b["sub"])}</i></div></div></div>')
        steps = len(sc['bars'])
        badge = ''
        if sc.get('badge'):
            steps += 1
            badge = f'<div class="badge st" data-step="{steps}">{E(sc["badge"])}</div>'
        body = t + f'<div class="bars">{rows}</div>{badge}'

    elif k == 'table2':
        head = '<tr><th></th>' + ''.join(f'<th class="c">{E(c)}</th>' for c in sc['cols']) + '</tr>'
        rows = ''
        for r in sc['rows']:
            cls = ' class="st" data-step="1"' if r.get('mark') else ''
            a = f'<td class="{"mark" if r.get("mark") == "a" else ""}">{r["a"]}</td>'
            b = f'<td class="{"mark" if r.get("mark") == "b" else ""}">{r["b"]}</td>'
            rows += f'<tr{cls}><td class="h">{E(r["head"])}</td>{a}{b}</tr>'
        steps = 1 if any(r.get('mark') for r in sc['rows']) else 0
        body = t + f'<table class="cmp">{head}{rows}</table>'
        if sc.get('foot'):
            body += f'<div class="foot">{sc["foot"]}</div>'

    elif k == 'levels':
        lv = ''.join(
            f'<div class="lvl {l["tone"]} st" data-step="{n}"><div class="txt">{E(l["label"])}'
            f'<b>{E(l["value"])}</b></div></div>'
            for n, l in enumerate(sc['levels'], 1))
        chip = f'<div class="chip">{E(sc["chip"])}</div>' if sc.get('chip') else ''
        steps = len(sc['levels'])
        body = t + f'<div class="levels">{chip}{lv}</div>'

    elif k == 'linechart':
        W, H = 880, 440
        L, R, TOP, BOT = 100, 840, 70, 350
        pts = sc['points']
        vals = [p['y'] for p in pts if p.get('y')]
        lo, hi = min(vals + [sc['ref']['value']]) - 1600, max(vals) + 1600

        def X(i):
            return round(L + i * (R - L) / (len(pts) - 1), 1)

        def Y(v):
            return round(BOT - (v - lo) / (hi - lo) * (BOT - TOP), 1)

        known = [(i, p) for i, p in enumerate(pts) if p.get('y')]
        (i0, p0), (i1, p1) = known[0], known[-1]
        d = (f'M{X(i0)},{Y(p0["y"])} C{X(i0)+160},{Y(p0["y"])-4} '
             f'{X(i1)-200},{Y(p1["y"])+90} {X(i1)},{Y(p1["y"])}')
        ry = Y(sc['ref']['value'])

        ev, labels = '', ''
        for i, p in enumerate(pts):
            labels += f'<div class="clbl tick" style="left:{X(i)}px;top:{BOT+40}px">{E(p["x"])}</div>'
            if p.get('tick'):
                ev += (f'<line x1="{X(i)}" y1="{TOP-24}" x2="{X(i)}" y2="{BOT}" '
                       f'stroke="#44536e" stroke-dasharray="4 6"/>')
                labels += f'<div class="clbl ev" style="left:{X(i)}px;top:{TOP-56}px">{E(p["tick"])}</div>'

        dots = ''
        for n, (i, p) in enumerate(known):
            right = n > 0
            dots += f'<circle cx="{X(i)}" cy="{Y(p["y"])}" r="8" fill="#eac77e"/>'
            x = X(i) - 16 if right else X(i) + 18
            r = ' r' if right else ''
            top_l = Y(p['y']) - (84 if right else 112)
            top_n = Y(p['y']) - (46 if right else -16)
            labels += (f'<div class="clbl big st{r}" data-step="2" '
                       f'style="left:{x}px;top:{top_l}px">{E(p["label"])}</div>')
            if p.get('note'):
                labels += (f'<div class="clbl note st{r}" data-step="2" '
                           f'style="left:{x}px;top:{top_n}px">{E(p["note"])}</div>')
        labels += (f'<div class="clbl ref r" style="left:{R}px;top:{ry+16}px">{E(sc["ref"]["label"])}</div>')

        side = ''.join(f'<div class="st" data-step="3"><small>{E(s2["head"])}</small><b>{E(s2["value"])}</b>'
                       f'<p>{E(s2["sub"])}</p></div>' for s2 in sc['side'])
        svg = (f'<svg class="chart" viewBox="0 0 {W} {H}" aria-hidden="true">'
               f'<line class="axis" x1="{L-50}" y1="{BOT+8}" x2="{R+20}" y2="{BOT+8}"/>{ev}'
               f'<line class="ref" x1="{L-50}" y1="{ry}" x2="{R+20}" y2="{ry}"/>'
               f'<path class="line st" data-step="1" pathLength="1" d="{d}"/>'
               f'<g class="st" data-step="2">{dots}</g></svg>')
        steps = 3
        body = t + (f'<div class="chart-wrap"><div class="chart-box">{svg}{labels}</div>'
                    f'<div class="side">{side}</div></div>')

    elif k == 'board':
        cards = ''.join(f'<article><small>{E(c["kicker"])}</small><b>{E(c["value"])}</b>{li(c["list"])}</article>'
                        for c in sc['cards'])
        body = (f'<div class="board">{sc["board"]}</div>' + t.replace('h2 class="t"', 'h2 class="t sub-t"') +
                f'<div class="rate-cards">{cards}</div>')

    elif k == 'compare':
        blocks = ''
        for n, b in enumerate(sc['blocks'], 1):
            rows = ''
            for it in b['items']:
                rows += (f'<div class="row {it.get("tone","")}"><span class="n">{E(it["name"])}</span>'
                         f'<span class="v">{E(it["value"])}</span></div>')
                if it.get('note'):
                    rows += f'<div class="note">{E(it["note"])}</div>'
            blocks += f'<div class="blk st" data-step="{n}"><div class="day">{E(b["day"])}</div>{rows}</div>'
        bd = sc['band']
        steps = len(sc['blocks']) + 1
        band = (f'<div class="band st" data-step="{steps}"><span>{E(bd["left"])}</span>⇔<span>{E(bd["right"])}</span>'
                f'<span class="g">{E(bd["gap"])}</span><span class="nt">{E(bd["note"])}</span></div>')
        body = t + f'<div class="blocks">{blocks}</div>{band}'

    elif k == 'branches':
        a = sc['aside']
        aside = (f'<div class="aside"><h4>{E(a["head"])}</h4>{li([E(x) for x in a["list"]])}'
                 f'<div class="nt">{E(a["note"])}</div></div>')
        arts = ''
        for n, b in enumerate(sc['branches'], 1):
            chip = '<div class="best-chip">最有力</div>' if b.get('best') else ''
            arts += (f'<article class="st{" best" if b.get("best") else ""}" data-step="{n}">{chip}'
                     f'<div class="tag">{E(b["tag"])}</div><div><h3>{E(b["name"])}</h3>{li([E(x) for x in b["list"]])}</div>'
                     f'<div class="cond">{E(b["cond"])}</div></article>')
        steps = len(sc['branches'])
        body = t + f'<div class="abc-wrap">{aside}<div class="abc">{arts}</div></div>'

    elif k == 'numbers3':
        arts = ''.join(f'<article class="st" data-step="{n}"><small>{E(i["no"])}</small><h3>{E(i["name"])}</h3>'
                       f'<b>{E(i["value"])}</b><p>{E(i["note"])}</p></article>'
                       for n, i in enumerate(sc['items'], 1))
        steps = len(sc['items'])
        body = t + f'<div class="three">{arts}</div>'

    else:
        raise SystemExit(f'unknown kind: {k}')

    return (f'<section class="scene sc-{k}" data-steps="{steps}" data-id="{sc["id"]}" data-no="{sc["no"]}" '
            f'data-at="{sc["at"]}" data-len="{sc["len"]}">{body}</section>')


SCRIPT = '''
const scenes=[...document.querySelectorAll('.scene')];let cur=0,step=0;
function paint(){const s=scenes[cur];s.querySelectorAll('.st').forEach(e=>e.classList.toggle('in',+e.dataset.step<=step));
 document.querySelector('#count').textContent=(cur+1)+' / '+scenes.length+'  '+s.dataset.id;
 [...document.querySelectorAll('#index button')].forEach(function(b,i){b.classList.toggle('active',i===cur)});
 document.querySelector('#info').innerHTML='資料 '+s.dataset.id+'／シーン'+s.dataset.no+'　'+s.dataset.at+'　'+s.dataset.len+'<br>'+(step)+' / '+s.dataset.steps+' 状態';}
function show(n,end){if(n<0||n>=scenes.length)return;cur=n;scenes.forEach((s,i)=>{s.classList.toggle('on',i===n);s.inert=i!==n});
 step=end?+scenes[n].dataset.steps:0;paint()}
function next(){const m=+scenes[cur].dataset.steps;if(step<m){step++;paint()}else show(cur+1)}
function prev(){if(step>0){step--;paint()}else show(cur-1,true)}
addEventListener('keydown',e=>{if(['ArrowRight','PageDown',' ','Enter'].includes(e.key)){e.preventDefault();next()}
 else if(['ArrowLeft','PageUp'].includes(e.key)){e.preventDefault();prev()}
 else if(e.key==='u'){document.body.classList.toggle('ui')}
 else if(e.key==='i'){document.body.classList.toggle('info')}
 else if(e.key==='f'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()}
 else if(e.key==='Home'){show(0)}});
document.querySelector('#next').onclick=function(e){e.stopPropagation();next()};
document.querySelector('#prev').onclick=function(e){e.stopPropagation();prev()};
var idx=document.querySelector('#index');
scenes.forEach(function(s,i){var b=document.createElement('button');b.textContent=s.dataset.id;
 b.onclick=function(e){e.stopPropagation();show(i)};idx.appendChild(b)});
document.querySelector('#stage').addEventListener('click',function(e){if(!e.target.closest('button'))next()});
function fit(){document.documentElement.style.setProperty('--scale',Math.min(innerWidth/1440,innerHeight/810))}
addEventListener('resize',fit);fit();
const q=new URLSearchParams(location.search);show(Math.max(0,(+q.get('s')||1)-1),q.get('full')==='1');
if(q.get('step')!==null){step=Math.min(+q.get('step'),+scenes[cur].dataset.steps);paint()}
'''

page = ('<!doctype html><html lang="ja"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f'<title>{E(meta["title"])}</title><style>{CSS}</style></head><body><div id="stage">'
        + ''.join(build(s) for s in scenes) +
        '<div id="index"></div>'
        '<div id="hint">クリック / → で進む　f 全画面　u 画面だけにする　i 尺</div>'
        '<div id="ui"><button id="prev">‹</button><span id="count"></span><button id="next">›</button></div>'
        '<div id="info"></div></div>'
        f'<script>{SCRIPT}</script></body></html>')

out = ROOT / f'ep{EP}' / 'index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page, encoding='utf-8')
print(f'{len(scenes)} scenes -> {out}')
