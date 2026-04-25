# Hackathon AI Web App Foundation

Chrome ベースの AI ハッカソン向けに用意した、テーマ非依存のフロントエンド土台です。

## 現在の実装到達度（2026-04-25）

- 現状は **ZEN Inbox v1 の統合中段階** です（`mock / manual / gmail` を切り替え、Gmail OAuth・実データ読込・ラベル書き戻し導線まで接続済み）。
- まだ未実装:
  - 補助チャットの自然文クエリを一覧再整理ロジックへ構造化反映する機構（現在は再整理プロンプト生成中心）
  - 永続状態（未処理/保留/今日やる/要返信）とユーザー修正保持
  - Gmail エラー時のローカルスナップショット保持など運用強化

## 含まれているもの

- React + Vite + TypeScript のアプリ土台
- 最終機能を載せるためのテーマ用ワークスペース
- 次の AI プロバイダー抽象化レイヤー
  - Chrome Built-in AI
  - Transformers.js（予約枠のみ。まだ generate 実装なし）
  - Gemini API フォールバック
- 提出メタデータ表示とチェックリスト

## コマンド

```bash
npm install
npm run dev
npm run build
npm run build:windows-safe
npm run lint
```

`npm run build` が Windows の日本語パス環境で落ちる場合は、ASCII-only の一時パスで build して結果を戻す `npm run build:windows-safe` を使えます。

## 環境変数

Gemini フォールバックを使う場合だけ `.env.example` を `.env` にコピーしてください。

```bash
VITE_GEMINI_API_KEY=your_key
VITE_GEMINI_MODEL=gemini-2.5-flash
```

API キーを設定しなくてもアプリ自体は動作し、Gemini プロバイダーは未設定として表示されます。

## クラウド AI 利用ポリシー（v1 開発ルール）

- 実 Gmail データを扱う場合、クラウド送信はデフォルト無効にする。
- クラウド送信前に、明示的な同意（トグルまたは確認）を必須にする。
- 送信テキストには匿名化を適用する（メールアドレス、署名、引用履歴など）。
- UI 上で「どのプロバイダーに送るか」を常時表示し、ローカル実行との差を隠さない。
- エラー表示はサニタイズし、生メール本文が露出しないようにする。
- 詳細ポリシー: `app/docs/cloud-ai-consent-policy.md`

## Windows + OneDrive での既知リスク

このリポジトリ環境では `npm run build` が `spawn EPERM` で失敗するケースを確認しています。  
アプリ実装バグではなく、環境要因（OneDrive 配下・権限・実行制御）の可能性があります。

切り分け手順:
1. OneDrive 外のローカルパスへコピーして `npm run build` を再実行
2. PowerShell を管理者権限で起動して再実行
3. セキュリティソフト・Controlled Folder Access の影響を確認
4. 失敗時は `npx tsc -b --pretty false` が通るかを先に確認し、型エラーと環境エラーを分離
