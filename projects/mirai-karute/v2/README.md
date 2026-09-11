# ミライカルテ v2（金融機関提出レベルのヒアリング対応版）

`main/` を 2026-09-11 に複製して分岐したものです。**`main/` は経営会議時点の状態としてそのまま保存**し、
こちらで「金融機関・不動産へ渡せるヒアリング項目」を実装します。

## 収録している3本

| 画面 | ファイル | 用途 | 所要 |
|---|---|---|---|
| アンケート診断 | `screening-entry.html` | 適性検査型の入口。A案/B案/まず学ぶ へ振り分け | 約2分・1人10問 |
| A案 | `pattern-a-dashboard.html` | 金融（即時計算ダッシュボード） | 約60秒 |
| B案 | `pattern-b-roadmap.html` | 不動産・ライフスタイル（伴走型ロードマップ） | 約3分 |

入口は `index.html`。3本を並べて比較・操作できます。
アンケート診断は 10_ツール開発_20260827/カルテUI/mirai-karte.html を取り込んだもので、
使い方動画をdata URIで内包しているため単体で完結します（約540KB）。

## main からの変更点

### B案（pattern-b-roadmap.html）— 不動産・ライフスタイル側

STEP1「今の暮らしと資産」に3項目を追加しました。

| 追加項目 | 入力ID | 形式 |
|---|---|---|
| 今の勤務先での勤続年数 | `b-tenure` | 数値（年） |
| 住宅ローン以外の借入残高 | `b-loans` | 数値（万円） |
| 住まいについて、いま近いのは | `b-property` | 5択（いまは考えていない／いつか持ちたい／3年以内に検討／すでに持ち家／投資用に関心） |

### A案（pattern-a-dashboard.html）— 金融側

サイドの入力パネルに4項目を追加しました。

| 追加項目 | 入力ID |
|---|---|
| 勤続年数 | `tenure` |
| 住宅ローン以外の借入 | `loans` |
| 世帯構成 | `household` |
| 住まいについて、いま近いのは | `property` |

A案は数値を変えるたびに即時再計算するため、**入力と同時に screening も更新**されます。

### 運営データの出力（screening）

結果表示のタイミングで、顧客DBへ渡す形のオブジェクトを生成します。

- `window.__ops` に格納
- `localStorage["mirai_karte_ops_b"]` に保存
- `document` に `mirai:ops` カスタムイベントを発火（外部の送信処理をここに繋げます）

スキーマは アンケート診断（mirai-karte.html）と同じ `mirai-karte-ops/v2` で、`source` で発生元を区別します。

```json
{
  "schema": "mirai-karte-ops/v2",
  "source": "pattern-b",
  "screening": {
    "income_band": "世帯手取り年収 約900万円",
    "asset_band": "金融資産 約500万円",
    "debt_status": "住宅ローン以外の借入 約180万円",
    "employment": "個人事業主・フリーランス",
    "tenure_years": 12,
    "annual_income": 900,
    "existing_loans": 180,
    "family": "夫婦・パートナーあり",
    "property_interest": "3年以内に検討したい"
  }
}
```

アンケート診断側で空欄（null）だった6項目が、A案・B案ではすべて実値で埋まります。
`source` が `pattern-a` / `pattern-b` になる以外、形は同一です。

実機で確認した出力例（A案）:

```json
{ "income_band": "年収 約780万円", "asset_band": "金融資産 約500万円",
  "debt_status": "住宅ローン以外の借入 約250万円", "employment": "法人経営者・役員",
  "tenure_years": 8, "annual_income": 780, "existing_loans": 250,
  "family": "子どもと同居", "property_interest": "投資用の物件に関心がある" }
```

## 残作業

- 送信先（サーバー／スプレッドシート等）を決めて `mirai:ops` に繋ぐ
- 項目の過不足を田中さん・平野さんに確認する
- 金融機関提出レベルの要件確定（項目の過不足を先方に確認したうえで確定させる）

## 動かし方

ビルド不要の静的ファイルです。GitHub Pages でそのまま配信されます。
ローカル確認は `python3 -m http.server` をこのディレクトリで実行してください。
