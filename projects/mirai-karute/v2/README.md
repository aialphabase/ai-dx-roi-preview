# ミライカルテ v2（金融機関提出レベルのヒアリング対応版）

`main/` を 2026-09-11 に複製して分岐したものです。**`main/` は経営会議時点の状態としてそのまま保存**し、
こちらで「金融機関・不動産へ渡せるヒアリング項目」を実装します。

## main からの変更点

### B案（pattern-b-roadmap.html）— 不動産・ライフスタイル側

STEP1「今の暮らしと資産」に3項目を追加しました。

| 追加項目 | 入力ID | 形式 |
|---|---|---|
| 今の勤務先での勤続年数 | `b-tenure` | 数値（年） |
| 住宅ローン以外の借入残高 | `b-loans` | 数値（万円） |
| 住まいについて、いま近いのは | `b-property` | 5択（いまは考えていない／いつか持ちたい／3年以内に検討／すでに持ち家／投資用に関心） |

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

アンケート診断側で空欄（null）だった6項目が、B案ではすべて実値で埋まります。

## 残作業

- A案（pattern-a-dashboard.html）側にも同じ `screening` 出力を実装する
- 送信先（サーバー／スプレッドシート等）を決めて `mirai:ops` に繋ぐ
- 項目の過不足を田中さん・平野さんに確認する

## 動かし方

ビルド不要の静的ファイルです。GitHub Pages でそのまま配信されます。
ローカル確認は `python3 -m http.server` をこのディレクトリで実行してください。
