# MVP接続設計

## 推奨構成

```text
LINE / LIFF
  -> ミライカルテ静的フロント
  -> Laravel API
  -> MySQL（正本）
  -> Queue / Scheduler
      -> Google Sheets転記
      -> LINE結果返却
      -> 高温度ユーザー通知
```

## 回答送信API

`POST /api/v1/diagnoses`

```json
{
  "source": "line",
  "variant": "A",
  "line_user_id_token": "LIFFで取得したIDトークン",
  "member_id": null,
  "answers": {
    "age": 39,
    "goal_age": 65,
    "annual_income_band": "500-699",
    "financial_assets_band": "500-999",
    "monthly_investment": 10,
    "risk_tolerance": "balanced",
    "investment_experience": "1-3y",
    "interests": ["investment", "ai"],
    "meeting_requested": false
  },
  "consents": {
    "privacy": true,
    "personalized_offer": true,
    "partner_referral": false
  }
}
```

サーバー側で回答値から再計算し、ブラウザ計算値は参考情報としてのみ扱います。

## レスポンス

```json
{
  "diagnosis_id": "01J...",
  "result_token": "署名付きランダムトークン",
  "scores": {
    "asset_need": 74,
    "investment_motivation": 68,
    "proposal_fit": 81,
    "ltv_prediction": 62,
    "overall": 73
  },
  "diagnosis": {
    "primary_type": "income_expansion",
    "secondary_type": "asset_preparation",
    "customer_stage": "proposal_candidate",
    "heat": "medium"
  },
  "notification_required": false
}
```

## 最小DB

### users

- `id`
- `line_user_id_hash`
- `member_id`
- `name_encrypted`
- `membership_type`
- `created_at`
- `updated_at`

### diagnoses

- `id`
- `user_id`
- `variant`
- `source`
- `status`
- `answers_json`
- `scores_json`
- `primary_type`
- `secondary_type`
- `customer_stage`
- `heat`
- `meeting_requested`
- `notification_required`
- `result_token_hash`
- `completed_at`
- `created_at`
- `updated_at`

### consent_logs

- `id`
- `diagnosis_id`
- `privacy_policy_version`
- `personalized_offer`
- `partner_referral`
- `ip_hash`
- `user_agent_hash`
- `consented_at`

### integration_jobs

- `id`
- `diagnosis_id`
- `destination`
- `status`
- `attempts`
- `last_error`
- `processed_at`
- `created_at`
- `updated_at`

## 担当者通知条件

以下のどれかに該当した場合に通知します。

- 面談希望あり
- 総合スコア80以上
- 1か月以内の相談希望
- 金融資産1000万円以上、かつ不動産・法人化・AI導入のいずれかに関心
- 法人経営者、かつ法人化・節税・法人資産運用に関心

通知の重複を避けるため、`diagnosis_id + notification_rule_version` を一意キーにします。

## Google Sheets

MySQL保存を先に完了させ、キュー処理で1診断1行を追記します。Sheets障害時も診断完了を止めず、`integration_jobs` から再送します。個人情報の列は必要最小限とし、閲覧権限を運営担当者へ限定します。

## LINE

- 初期: LINE配信URLに短命の署名付き流入トークンを付与
- 次段階: LIFFでログインし、IDトークンをLaravelへ送信
- サーバーでLINEのIDトークンを検証してからユーザーを紐付け
- 回答完了後はMessaging APIで診断タイプ、現在地、次の一手、結果URLを返却
- チャネルアクセストークンはブラウザへ置かない

## A/B計測イベント

- `karte_opened`
- `karte_input_started`
- `karte_step_completed`
- `karte_scenario_changed`
- `karte_result_viewed`
- `karte_meeting_requested`
- `karte_line_returned`

イベントには `variant`, `source`, `campaign_id`, `anonymous_session_id` を付与します。診断完了前は匿名セッションとして扱い、同意取得後にユーザーへ紐付けます。
