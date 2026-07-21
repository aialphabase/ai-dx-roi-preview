# AI DX GitHub 共同運用メモ（Claude向け）

更新日：2026-07-21  
対象リポジトリ：`aialphabase/ai-dx-roi-preview`  
公開URL：<https://aialphabase.github.io/ai-dx-roi-preview/>

## 1. このリポジトリの目的

AI DX（AIDX）とミライカルテの確認用サイト・シミュレーション・説明資料を、GitHub Pagesで共有するためのリポジトリです。

`main` ブランチへ反映された内容が公開サイトへ配信されます。公開前の作業は、原則として作業用ブランチで行ってください。

## 2. 現在の主要URL

- プロジェクトハブ：<https://aialphabase.github.io/ai-dx-roi-preview/>
- AIDX入口：<https://aialphabase.github.io/ai-dx-roi-preview/projects/aidx/>
- AIDX Codex版：<https://aialphabase.github.io/ai-dx-roi-preview/codex/>
- AIDX Claude版：<https://aialphabase.github.io/ai-dx-roi-preview/claude/>
- ミライカルテ入口：<https://aialphabase.github.io/ai-dx-roi-preview/projects/mirai-karute/>
- ミライカルテ A/B案：<https://aialphabase.github.io/ai-dx-roi-preview/projects/mirai-karute/main/>

キャッシュを避けて確認するときは、URL末尾へ `?nocache=YYYYMMDDHHMM` を付けます。

## 3. 主要フォルダの役割

```text
/
├── index.html                     # 全体プロジェクトハブ
├── README.md                      # リポジトリ概要
├── robots.txt                     # 全体を検索除外
├── projects/
│   ├── aidx/
│   │   ├── index.html             # AIDX入口・内部向け資料一覧
│   │   └── assets/                # AIDX説明図・確認資料
│   └── mirai-karute/              # ミライカルテ入口とA/B案
├── codex/                         # 既存AIDX Codex版
├── claude/                        # 既存AIDX Claude版
└── simulations/                   # 各種シミュレーション
```

### 変更時の原則

- AIDXの説明資料追加は `projects/aidx/assets/` へ置き、`projects/aidx/index.html` に項目を追加する。
- `codex/` と `claude/` は既存の診断サイト。明示された案件以外では上書きしない。
- ミライカルテは `projects/mirai-karute/` と `simulations/mirai-karute/` の責任範囲を混同しない。
- 公開済みのパスとファイル名は、リンク切れ防止のため原則変更しない。

## 4. AIDXの現在の状態

AIDX入口の下部には「内部向け資料」として、次の2点を掲載しています。

1. `AIDX_Cowork_案件表紙_図_v0.1.svg`
   - Claude Coworkへ資料を渡し、主要5PJの下書きを同じ型で受け取る流れ
   - PJ-01〜PJ-05と、人が最終確認する箇所を表示
2. `AIDX_品質確認2種類_議題図_v0.1.svg`
   - テンプレート品質確認と、3か月導入期間中の継続レビューを整理した議題図

2026-07-21時点で、案件表紙図の右下に一時追加していた「追加要件・企画書」の記載は、現仕様と直接関係しないため削除済みです。

このメモ作成直前の本番基準コミットは `a80661e` です。最新状態は必ず次で確認してください。

```bash
git fetch origin
git log -1 --oneline origin/main
```

## 5. Claudeで更新するときの推奨手順

### 作業開始

```bash
git fetch origin
git switch main
git pull --ff-only origin main
git status
git switch -c claude/作業内容
```

重要：作業ブランチ作成時に `origin/main` を追跡先として設定しないでください。GitHub Desktopで「Push」した際、意図せず `main` へ直接送信する原因になります。

### 制作・確認

1. 対象ファイルだけを変更する。
2. HTMLはローカルHTTPサーバーで表示する。
3. PC・スマートフォン、最下部、横スクロール、リンク、画像読み込みを確認する。
4. HTML構文とブラウザエラーを確認する。
5. `git diff --check` と `git status` で不要な変更がないことを確認する。

### 保存・共有

```bash
git add 対象ファイル
git commit -m "変更内容を短く記載"
git push -u origin claude/作業内容
```

コマンドラインで認証エラーになる場合は、ログイン済みのGitHub Desktopから「Publish branch」または「Push origin」を使います。

### 本番反映

- 作業ブランチの表示確認後に `main` へ統合する。
- `main` への直接反映は、差分と公開内容が確認済みの場合だけ行う。
- 反映後はGitHub Pagesの公開URLで再確認する。
- 公開確認が終わるまで、元ファイルや旧版を削除しない。

## 6. HTML・素材制作ルール

- 完全な静的HTMLを基本とし、ビルド工程なしで動作させる。
- React、JSX、独自ランタイム、大容量base64埋め込みは使用しない。
- `html, body { overflow-x: hidden; }` を設定し、モバイルの横スクロールを防ぐ。
- CDNやJavaScriptが失敗しても本文が見える構成にする。
- SVGは `<script>`、`javascript:`、`foreignObject` を含めない。
- 画像や動画は適正サイズへ軽量化し、未使用素材を公開フォルダへ入れない。
- 公開ページには `noindex,nofollow,noarchive` を設定する。

## 7. 公開・情報管理上の注意

このリポジトリとGitHub Pagesは公開状態です。`noindex` や `robots.txt` は検索除外であり、アクセス制限ではありません。

次の情報は置かないでください。

- 顧客固有情報、個人情報、未公開契約情報
- パスワード、APIキー、認証情報
- 社外非公開の価格・財務・法務資料
- 公開承認を得ていない会議録や添付ファイル

内部限定にする必要がある成果物は、この公開リポジトリではなく、アクセス制限された別の保管場所を使用します。

## 8. 競合・手戻りを防ぐ共有ルール

- 作業開始前に `git fetch origin` を実行する。
- 同じファイルをCodexとClaudeで同時編集しない。
- 変更前に「担当ファイル・目的・公開予定」を共有する。
- 原本は変更せず、必要に応じて版番号付きコピーを作る。
- 判断が未確定の内容は本番ページへ直接追加せず、候補版またはメモとして分離する。
- 変更後は、ファイル名・コミット・公開URL・確認結果を共有する。

## 9. Claudeへの作業開始時プロンプト例

```text
この案件では aialphabase/ai-dx-roi-preview を共通リポジトリとして使用します。
最初に CLAUDE_HANDOFF.md と README.md を読み、origin/main を最新化してください。
既存の公開URLとファイル名は維持し、今回指定されたファイルだけを作業用ブランチで変更してください。
完成後はPC・スマホ・横スクロール・リンク・画像・ブラウザエラーを確認し、変更ファイル、コミット、公開候補URLを報告してください。
顧客固有情報や認証情報は公開リポジトリへ追加しないでください。
```

---

このメモと実際の `origin/main` に差がある場合は、リポジトリの最新状態を優先してください。
