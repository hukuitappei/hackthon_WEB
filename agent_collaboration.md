# 協調実装計画

## 目的
- `ZEN Inbox` を Chrome 前提の Web アプリとして実装する
- 一覧中心の Inbox 整理体験を最優先にする
- AI が使えない場合でも成立し、外部連携失敗でも壊れない構成にする

## 共通制約
- 主な実行環境は Google Chrome とする
- 主役はチャットではなくダッシュボードとする
- AI は補助であり、必ずルールベースのフォールバックを持つ
- Gmail への書き戻しはラベル付与のみに限定する
- Slack / LINE は v1 では実連携せず、将来拡張の考慮に留める

## 担当分担
### Codex 担当
- 全体設計と統合境界の管理
- データモデルと正規化フローの設計
- フォールバック前提の Inbox パイプライン設計
- 共通型、セレクタ、整理オーケストレーションの実装
- リポジトリ整備、コミット、push、最終統合作業

### Claude Code 担当
- ダッシュボードの見た目と操作体験の具体化
- Inbox カード、フィルタ、空状態、接続状態表示の UI 実装
- `ZEN` らしい静かなコピーと表示文言の調整
- デモ時に伝わりやすい画面導線と体験の磨き込み

## ファイル責務
### Codex 管轄
- `app/src/features/inbox/**`
- `app/src/features/gmail/**`
- `app/src/features/ai/**`
- `app/src/hooks/**`
- `app/src/lib/**`
- `plan3_requirements.md`

### Claude Code 管轄
- `app/src/components/**`
- `app/src/styles/**`
- `app/src/App.tsx`
- `app/src/App.css`
- `app/src/index.css`

## 協調ルール
- 事前合意なしに同じファイルを同時編集しない
- 他方の変更を勝手に巻き戻さない
- まず `types.ts` などの安定インターフェースを先に確定する
- Gmail 連携が詰まっても、モックデータで UI 実装は止めない
- オンデバイス AI が使えなくても、ルールベース分類で価値を維持する

## 実装順
1. Codex がコア型と Inbox パイプラインの契約を定義する
2. Claude Code がモックデータ前提でダッシュボード UI を構築する
3. Codex がルール分類、AI オーケストレーション、source adapter を接続する
4. Claude Code が表示品質、説明面、審査向け導線を整える
5. Codex が全体統合、フォールバック確認、コミットと push を行う

## v1 完了条件
- `urgent / soon / someday` の一覧で Inbox を確認できる
- 各アイテムに source、要約、日時、分類、優先度、次アクションが表示される
- Gmail が使えなくてもモックデータで体験を再現できる
- AI 強化が見えるが、AI なしでも UI と整理体験が成立する
- エラー時や空状態でも意味の分かる表示を維持できる
