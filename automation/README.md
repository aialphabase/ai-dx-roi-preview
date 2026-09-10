# アセットマップ夜間自動更新

平日23:00 JST に GitHub Actions が `scripts/update_asset_map.py` を実行する。PC不要。

## モード
- **dry**: 取得→検証→`automation/out/*.draft.json` のみ生成。公開ファイルに触れない
- **live**（現在こちら）: 検証合格時のみ `automation/out/asset-data.json`・`asset-history.json` を更新。
  GitHub Pages がこれを配信し、`/17/asset-map.html` が直接読むので**FTPも認証情報も不要**。
  不合格の日は公開ファイルを更新しない（前回値が残る）

## 公開の流れ（2026-09-10〜）
```
夜間ジョブ → automation/out/asset-{data,history}.json を更新 → ワークフローがコミット
   → GitHub Pages が配信 → asset-map.html が fetch（サーバー上のファイルはフォールバック）
```
- 一次ソース: `https://aialphabase.github.io/ai-dx-roi-preview/automation/out/asset-data.json`
- Discordへの自動投稿は**廃案**（会員は週間ロードマップのページで見る）

## 設定済み（2026-09-10）
- Variables: `ASSET_MAP_MODE` = `live`
- Secrets: **不要**（FTP経路は廃止。`upload_ftp` は未使用のまま残置）
- 人が書く欄（shapeRead / news / question / imp）を直すときは `automation/out/asset-data.json` を編集してコミットする

## 自動と人の境界（原則）
- 自動が書く: `mark` / `cls` / `c` / `state`、history の当日1行
- 人が書く: `shape` / TODAY'S PICK（news） / `learn` / 今週の1問（quiz） / `imp`
- 資産に `"manual": true` を付けるとその資産は自動でも据え置き

## 事故時
- 検証不合格の日は更新しない（前日値が残る）。レポートは Actions の Summary と `automation/out/report.md`
- 完全に止めたい: Actionsタブでワークフローを Disable
