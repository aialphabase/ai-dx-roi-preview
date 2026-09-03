# アセットマップ夜間自動更新

平日23:00 JST に GitHub Actions が `scripts/update_asset_map.py` を実行する。PC不要。

## モード
- **dry**（既定）: 取得→検証→`automation/out/` にドラフト生成のみ。本番に触れない
- **live**: 検証合格時のみ `/17/asset-data.json`・`asset-history.json` をFTP更新し、DiscordへWebhook投稿。不合格の日は更新せず運営Webhookへ通知

## live への切り替え（素振り1週間の後に）
1. リポジトリ Settings → Secrets and variables → Actions
2. **Secrets** に登録: `FTP_HOST` / `FTP_USER` / `FTP_PASS` / `DISCORD_WEBHOOK_URL` / `DISCORD_OPS_WEBHOOK_URL`（運営通知用・任意）
3. **Variables** に登録: `ASSET_MAP_MODE` = `live`、`FTP_REMOTE_DIR` = `/17/` の実パス
4. Actionsタブ → asset-map-nightly → Run workflow で手動テスト

## 自動と人の境界（原則）
- 自動が書く: `mark` / `cls` / `c` / `state`、history の当日1行
- 人が書く: `shape` / TODAY'S PICK（news） / `learn` / 今週の1問（quiz） / `imp`
- 資産に `"manual": true` を付けるとその資産は自動でも据え置き

## 事故時
- 検証不合格の日は更新しない（前日値が残る）。レポートは Actions の Summary と `automation/out/report.md`
- 完全に止めたい: Actionsタブでワークフローを Disable
