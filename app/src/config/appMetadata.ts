export type FeatureSlot = {
  title: string
  tag: string
  description: string
  placeholder: string
}

export type AppMetadata = {
  teamName: string
  teamNameKana: string
  workTitle: string
  workTitleKana: string
  workUrl: string
  toolsUsed: string[]
}

export const appMetadata: AppMetadata = {
  teamName: 'ハッカソン初挑戦で',
  teamNameKana: 'はっかそんはつちょうせんで',
  workTitle: 'ZEN Inbox',
  workTitleKana: 'ぜん いんぼっくす',
  workUrl: 'https://hukuitappei.github.io/hackthon_WEB/',
  toolsUsed: ['React', 'Vite', 'TypeScript', 'Chrome Built-in AI', 'Gemini API', 'Codex multi-agent review'],
}

export const foundationGoals = [
  {
    title: 'Gmail first triage',
    description: 'Gmail を起点に、返信が必要なものと後で読むものを一画面で切り分ける。',
  },
  {
    title: 'One next action',
    description: '各メールに対して次にやることを一つだけ提示し、判断コストを下げる。',
  },
  {
    title: 'Practical AI fallback',
    description: 'ブラウザ内 AI を優先しつつ、必要時のみクラウド AI にフォールバックする。',
  },
]

export const workspaceSlots: FeatureSlot[] = [
  {
    tag: 'Inbox',
    title: '一覧再整理',
    description: 'Inbox 全体を俯瞰して、急ぎ・近日中・いつかの配分と次アクションを見直す。',
    placeholder: '例: 今日返すべきもの、会議前に読むもの、後でまとめて処理するものを整理',
  },
  {
    tag: 'Signals',
    title: '判断理由',
    description: '期限、返信要否、送信者の強さ、ノイズ度を見て分類理由を明示する。',
    placeholder: '例: 期限あり、要返信、社外重要、通知系',
  },
  {
    tag: 'AI Assist',
    title: 'AI provider check',
    description: 'ブラウザ AI とクラウド AI の状態を比較し、使える経路だけを提示する。',
    placeholder: '例: Prompt API ready / Gemini API opt-in required',
  },
]

export const submissionChecklist = [
  'チーム名と作品情報を確認する',
  '公開 URL を最終値に更新する',
  'Gmail 連携とプライバシー導線を確認する',
  '利用ツール一覧を提出内容と合わせる',
]
