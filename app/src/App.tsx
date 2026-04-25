import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { appMetadata, foundationGoals, submissionChecklist } from './config/appMetadata'
import { useGmailFeature } from './features/gmail'
import { buildInboxReorganizationPrompt, type InboxBucket, type InboxLabel } from './features/inbox'
import { useInboxState } from './hooks/useInboxState'
import {
  aiProviders,
  getExecutionPlan,
  getPreferredProviderId,
  type AIProvider,
  type AIResponse,
  type ProviderAvailability,
  type ProviderAvailabilityState,
  type ProviderId,
} from './lib/ai'

type AvailabilityMap = Partial<Record<ProviderId, ProviderAvailability>>

const providerLabel: Record<ProviderAvailabilityState, string> = {
  ready: '利用可能',
  downloadable: 'ダウンロードが必要',
  unavailable: '利用不可',
  'not-configured': '未設定',
  planned: '計画済スロット',
}

const bucketCopy: Record<InboxBucket, { label: string; summary: string }> = {
  urgent: {
    label: '急ぎ (Urgent)',
    summary: '不安をなくすために、今すぐ対応すべきもの。',
  },
  soon: {
    label: '近日中 (Soon)',
    summary: '重要ですが、今の集中を乱すほどではありません。',
  },
  someday: {
    label: 'いつか (Someday)',
    summary: 'まとめて処理、アーカイブ、または時間外に見直すもの。',
  },
}

function App() {
  const gmailFeature = useGmailFeature()
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityMap>({})
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>('browserBuiltIn')
  const [promptOverride, setPromptOverride] = useState('')
  const [chatObjective, setChatObjective] = useState('今日やるべきものを優先順に3件だけ示してください。')
  const [result, setResult] = useState<AIResponse | null>(null)
  const [executionNote, setExecutionNote] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [allowCloudProcessing, setAllowCloudProcessing] = useState(false)
  const [isCheckingProviders, setIsCheckingProviders] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

  const {
    activeItem,
    bucketCounts,
    bucketFilter,
    openOriginalMail,
    organizedItems,
    selectedSource,
    setSelectedSource,
    sourceOptions,
    totalCount,
    visibleItems,
    searchText,
    setActiveId,
    setBucketFilter,
    setSearchText,
  } = useInboxState({ gmailItems: gmailFeature.items })

  useEffect(() => {
    let active = true

    async function loadAvailability() {
      setIsCheckingProviders(true)

      const entries = await Promise.all(
        aiProviders.map(async (provider) => {
          try {
            const availability = await provider.checkAvailability()
            return [provider.id, availability] as const
          } catch (providerError) {
            const detail =
              providerError instanceof Error ? providerError.message : 'Unknown availability error.'

            return [
              provider.id,
              {
                state: 'unavailable',
                summary: 'Availability check failed.',
                detail,
              } satisfies ProviderAvailability,
            ] as const
          }
        }),
      )

      if (!active) {
        return
      }

      const nextMap = Object.fromEntries(entries) as AvailabilityMap
      setAvailabilityMap(nextMap)

      const preferredProviderId = getPreferredProviderId(nextMap)
      if (preferredProviderId) {
        setSelectedProviderId(preferredProviderId)
      }

      setIsCheckingProviders(false)
    }

    void loadAvailability()

    return () => {
      active = false
    }
  }, [])

  const recommendedProviderId = getPreferredProviderId(availabilityMap)
  const promptBase = buildInboxReorganizationPrompt(visibleItems.length > 0 ? visibleItems : organizedItems)
  const prompt = `${chatObjective.trim()}\n\n${promptOverride || promptBase}`
  const selectedBucketSummary =
    bucketFilter === 'all' ? 'すべての受信トレイアイテムを表示しています。' : bucketCopy[bucketFilter].summary
  const gmailRuntimeState = getGmailRuntimeState(selectedSource, gmailFeature)
  const stats = useMemo(
    () => [
      { label: '急ぎ', value: bucketCounts.urgent.toString() },
      { label: '近日中', value: bucketCounts.soon.toString() },
      { label: 'いつか', value: bucketCounts.someday.toString() },
    ],
    [bucketCounts],
  )

  async function handleRunPrompt() {
    setIsRunning(true)
    setError('')
    setResult(null)

    const executionPlan = getExecutionPlan(selectedProviderId, availabilityMap)

    if (executionPlan.length === 0) {
      setExecutionNote('利用可能なプロバイダーがありません。ルールベースの整理機能は引き続き動作します。')
      setError('実行可能なAIプロバイダーが現在利用できません。')
      setIsRunning(false)
      return
    }

    const planLabel = executionPlan.map((provider) => provider.name).join(' -> ')
    setExecutionNote(`実行経路: ${planLabel}`)

    for (const provider of executionPlan) {
      try {
        const response = await provider.generate({
          prompt,
          systemPrompt:
            'You are ZEN Inbox. Summarize the message, state one next action, and warn if the confidence seems low. Keep it concise and privacy-aware.',
          allowCloudProcessing,
        })
        setError('')
        setResult(response)
        setExecutionNote(
          provider.id === selectedProviderId
            ? `${provider.name} で実行しました。`
            : `選択された ${findProvider(selectedProviderId)?.name ?? selectedProviderId} がスキップされたか失敗したため、${provider.name} にフォールバックしました。`,
        )
        setIsRunning(false)
        return
      } catch (providerError) {
        const detail = providerError instanceof Error ? providerError.message : '不明な生成エラーです。'
        setError(formatProviderError(provider.id, provider.name, detail))
      }
    }

    setIsRunning(false)
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <h1>ZEN Inbox</h1>
          <p className="eyebrow">Gmail 受信トレイを AI で整理して、今日の一手を決める</p>
          <p className="hero-summary">
            Hackathon v1 用の Gmail ファーストな受信トレイ仕分けツール。メッセージを <strong>急ぎ</strong>,{' '}
            <strong>近日中</strong>, <strong>いつか</strong> に分類して理由を提示し、AI を必須ではなく支援レイヤーとして活用します。
          </p>
        </div>
        <div className="hero-status">
          <div className="stat-card stat-card-focus">
            <span className="stat-label">現在のフォーカス</span>
            <strong>{activeItem?.nextAction ?? 'メッセージを開いて次のステップを確認してください。'}</strong>
          </div>
          {stats.map((stat) => (
            <div key={stat.label} className="stat-card">
              <span className="stat-label">{stat.label}</span>
              <strong>{stat.value}</strong>
            </div>
          ))}
        </div>
      </header>

      <main className="dashboard">
        <section className="panel panel-inbox">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">受信トレイフィード</p>
              <h2>今日やるべきことを整理しよう。</h2>
            </div>
            <span className="pill">サンプル Gmail データ</span>
          </div>

          <div className="toolbar">
            <label className="search-field">
              <span>検索</span>
              <input
                onChange={(event) => setSearchText(event.target.value)}
                placeholder="送信者、件名、スニペットを検索"
                type="search"
                value={searchText}
              />
            </label>

            <div className="bucket-tabs" aria-label="Inbox bucket filter">
              <button className={bucketFilter === 'all' ? 'bucket-tab active' : 'bucket-tab'} onClick={() => setBucketFilter('all')} type="button">
                すべて
              </button>
              {(['urgent', 'soon', 'someday'] as const).map((bucket) => (
                <button
                  key={bucket}
                  className={bucketFilter === bucket ? 'bucket-tab active' : 'bucket-tab'}
                  onClick={() => setBucketFilter(bucket)}
                  type="button"
                >
                  {bucketCopy[bucket].label}
                </button>
              ))}
            </div>
          </div>

          <div className="source-tabs" role="tablist" aria-label="Inbox source selector">
            {sourceOptions.map((source) => (
              <button
                key={source.id}
                className={selectedSource === source.id ? 'source-tab active' : 'source-tab'}
                onClick={() => setSelectedSource(source.id)}
                type="button"
              >
                <strong>{source.label}</strong>
                <small>{source.description}</small>
              </button>
            ))}
          </div>

          {selectedSource === 'gmail' ? (
            <div className="detail-card">
              <div className="detail-actions">
                <p className="section-note">{gmailRuntimeState.summary}</p>
                <div className="message-actions">
                  <button className="message-link-button" disabled={!gmailFeature.canUse || gmailFeature.isBusy} onClick={() => void gmailFeature.signIn()} type="button">
                    {gmailFeature.connection.signedIn ? 'Gmail 再接続' : 'Gmail 接続'}
                  </button>
                  <button
                    className="message-link-button"
                    disabled={!gmailFeature.connection.signedIn || gmailFeature.isBusy}
                    onClick={() => void gmailFeature.refreshInbox()}
                    type="button"
                  >
                    Gmail 更新
                  </button>
                  <button
                    className="message-link-button"
                    disabled={!gmailFeature.connection.signedIn || gmailFeature.isBusy}
                    onClick={() => gmailFeature.signOut()}
                    type="button"
                  >
                    切断
                  </button>
                </div>
              </div>
              {gmailRuntimeState.detail ? <p className="error-text">{gmailRuntimeState.detail}</p> : null}
            </div>
          ) : null}

          <p className="section-note">{selectedBucketSummary}</p>
          <p className="section-note">表示件数: {visibleItems.length} / {totalCount}</p>

          <div className="inbox-layout">
            <div className="message-list" role="list">
              {visibleItems.map((entry) => (
                <article
                  key={entry.item.id}
                  className={activeItem?.item.id === entry.item.id ? 'message-card active' : 'message-card'}
                >
                  <button
                    className="message-select"
                    onClick={() => {
                      setActiveId(entry.item.id)
                      setPromptOverride('')
                    }}
                    type="button"
                  >
                    <div className="message-topline">
                      <span className={`bucket-badge bucket-${entry.bucket}`}>{bucketCopy[entry.bucket].label}</span>
                      <span className="message-time">{formatDate(entry.item.receivedAt)}</span>
                    </div>
                    <strong>{entry.item.subject}</strong>
                    <span className="message-from">{entry.item.from}</span>
                    <p>{entry.item.snippet}</p>
                    <div className="message-meta">
                      <span>{formatKind(entry.kind)}</span>
                      <span>{entry.labelSuggestion}</span>
                      <span>{formatConfidence(entry.confidence)}</span>
                    </div>
                  </button>
                  <div className="message-actions">
                    <span className="message-link-label">{entry.item.source}</span>
                    <button
                      className="message-link-button"
                      disabled={!entry.item.webLink}
                      onClick={() => openOriginalMail(entry)}
                      type="button"
                    >
                      元メールを開く
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <article className="detail-card">
              {activeItem ? (
                <>
                  <div className="detail-header">
                    <div>
                      <p className="panel-kicker">理由と次のアクション</p>
                      <h3>{activeItem.item.subject}</h3>
                    </div>
                    <span className={`bucket-badge bucket-${activeItem.bucket}`}>{bucketCopy[activeItem.bucket].label}</span>
                  </div>

                  <div className="signal-grid">
                    <div className="signal-card">
                      <span className="stat-label">推奨ラベル</span>
                      <strong>{activeItem.labelSuggestion}</strong>
                    </div>
                    <div className="signal-card">
                      <span className="stat-label">種類</span>
                      <strong>{formatKind(activeItem.kind)}</strong>
                    </div>
                    <div className="signal-card">
                      <span className="stat-label">信頼度</span>
                      <strong>{formatConfidence(activeItem.confidence)}</strong>
                    </div>
                  </div>

                  <div className="focus-card">
                    <p className="focus-label">次のアクション</p>
                    <p className="focus-text">{activeItem.nextAction}</p>
                  </div>

                  <div className="detail-actions">
                    <button className="message-link-button" disabled={!activeItem.item.webLink} onClick={() => openOriginalMail(activeItem)} type="button">
                      元メールを開く
                    </button>
                    {selectedSource === 'gmail' ? (
                      <div className="message-actions">
                        {(['ZEN/Urgent', 'ZEN/Soon', 'ZEN/Someday', 'ZEN/Reply'] as InboxLabel[]).map((label) => (
                          <button
                            key={label}
                            className="message-link-button"
                            disabled={!gmailFeature.connection.signedIn || gmailFeature.isBusy}
                            onClick={() => void gmailFeature.applyLabel(activeItem.item.threadId, label)}
                            type="button"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="detail-copy">
                    <p>{activeItem.reason}</p>
                    <ul className="signal-list">
                      <li>返信が必要: {activeItem.signals.replyNeeded ? 'はい' : 'いいえ'}</li>
                      <li>今日が期限: {activeItem.signals.dueToday ? 'はい' : 'いいえ'}</li>
                      <li>ノイズの可能性: {activeItem.signals.likelyNoise ? 'はい' : 'いいえ'}</li>
                      <li>送信者の権威性: {activeItem.signals.senderAuthority}</li>
                    </ul>
                  </div>
                </>
              ) : (
                <p className="result-placeholder">現在のフィルターに一致するアイテムはありません。</p>
              )}
            </article>
          </div>
        </section>

        <section className="panel panel-ai">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">AI アシスト</p>
              <h2>コアフローを阻害せずに、Chrome Built-in AIとクラウドへのフォールバックを検証する。</h2>
            </div>
            <span className="pill pill-accent">{isCheckingProviders ? 'プロバイダーを確認中' : 'プロバイダー準備完了'}</span>
          </div>

          <div className="provider-grid">
            {aiProviders.map((provider) => {
              const availability = availabilityMap[provider.id]

              return (
                <label key={provider.id} className={`provider-card ${selectedProviderId === provider.id ? 'selected' : ''}`}>
                  <input
                    checked={selectedProviderId === provider.id}
                    className="provider-radio"
                    name="provider"
                    onChange={() => setSelectedProviderId(provider.id)}
                    type="radio"
                    value={provider.id}
                  />
                  <div className="provider-topline">
                    <h3>{provider.name}</h3>
                    <span className={`provider-state state-${availability?.state ?? 'planned'}`}>
                      {providerLabel[availability?.state ?? 'planned']}
                    </span>
                  </div>
                  <p>{provider.description}</p>
                  <small>{availability?.summary ?? 'プロバイダーの可用性を確認中。'}</small>
                </label>
              )
            })}
          </div>

          <div className="playground">
            <label className="search-field">
              <span>クラウド送信同意 (Gemini API)</span>
              <input
                checked={allowCloudProcessing}
                onChange={(event) => setAllowCloudProcessing(event.target.checked)}
                type="checkbox"
              />
            </label>
            <p className="section-note">
              オフ時は Gemini API を実行しません。オン時はメールアドレス・電話番号・URL を簡易匿名化したうえで送信します。
            </p>
            <label className="prompt-field">
              <span>再整理の目的</span>
              <input onChange={(event) => setChatObjective(event.target.value)} value={chatObjective} />
            </label>
            <label className="prompt-field">
              <span>AI プロンプト</span>
              <textarea
                onChange={(event) => setPromptOverride(event.target.value)}
                placeholder="空欄なら一覧スナップショットから再整理プロンプトを自動生成します。"
                rows={7}
                value={prompt}
              />
            </label>

            <div className="playground-actions">
              <button className="run-button" disabled={isRunning || prompt.trim().length === 0} onClick={() => void handleRunPrompt()} type="button">
                {isRunning ? '実行中...' : 'インボックスアシストを実行'}
              </button>
              <p className="execution-note">
                {executionNote ||
                  `推奨プロバイダー: ${recommendedProviderId ? findProvider(recommendedProviderId)?.name : 'プロバイダーを確認中'}`}
              </p>
            </div>

            <div className="result-card">
              <div className="result-header">
                <h3>アシスト結果</h3>
                {result ? <span className="pill">{result.providerName}</span> : null}
              </div>
              {error ? <p className="error-text">{error}</p> : null}
              {result ? <p className="result-text">{result.text}</p> : <p className="result-placeholder">AI の出力はまだありません。上記の整理機能は AI なしで動作します。</p>}
            </div>
          </div>
        </section>

        <section className="panel panel-project">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">プロジェクト情報</p>
              <h2>提出コンテキストとロールアウト保護策</h2>
            </div>
            <span className="pill">Hackathon v1</span>
          </div>

          <div className="goal-grid">
            {foundationGoals.map((goal) => (
              <article key={goal.title} className="goal-card">
                <h3>{goal.title}</h3>
                <p>{goal.description}</p>
              </article>
            ))}
          </div>

          <div className="metadata-grid">
            <article className="metadata-card">
              <h3>アプリ情報 (App metadata)</h3>
              <dl>
                <div>
                  <dt>チーム名</dt>
                  <dd>{appMetadata.teamName}</dd>
                </div>
                <div>
                  <dt>チーム名カナ</dt>
                  <dd>{appMetadata.teamNameKana}</dd>
                </div>
                <div>
                  <dt>作品名</dt>
                  <dd>{appMetadata.workTitle}</dd>
                </div>
                <div>
                  <dt>作品URL</dt>
                  <dd>{appMetadata.workUrl}</dd>
                </div>
              </dl>
            </article>

            <article className="metadata-card">
              <h3>使用ツール (Tools used)</h3>
              <ul className="tool-list">
                {appMetadata.toolsUsed.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </article>
          </div>

          <article className="checklist-card">
            <h3>提出前チェックリスト (Submission checklist)</h3>
            <ul className="checklist">
              {submissionChecklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        </section>
      </main>
    </div>
  )
}

function findProvider(providerId: ProviderId): AIProvider | undefined {
  return aiProviders.find((provider) => provider.id === providerId)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatKind(kind: string) {
  const labels: Record<string, string> = {
    reply_needed: '返信が必要',
    scheduled: '予定あり',
    deadline: '期限あり',
    read_later: 'あとで確認',
    subscription_candidate: '購読候補',
  }

  return labels[kind] ?? kind
}

function formatConfidence(confidence: string) {
  const labels: Record<string, string> = {
    high: '高',
    medium: '中',
    low: '低',
  }

  return `信頼度: ${labels[confidence] ?? confidence}`
}

function formatProviderError(providerId: ProviderId, providerName: string, detail: string) {
  if (providerId === 'geminiApi') {
    return `プロバイダー ${providerName} が失敗しました: クラウド処理の設定または通信条件を確認してください。`
  }

  return `プロバイダー ${providerName} が失敗しました: ${detail}`
}

function getGmailRuntimeState(
  selectedSource: 'mock' | 'manual' | 'gmail',
  gmailFeature: ReturnType<typeof useGmailFeature>,
) {
  if (selectedSource !== 'gmail') {
    return { summary: '現在はデモデータまたは手動データ表示です。' }
  }

  if (!gmailFeature.canUse) {
    return {
      summary: 'Google Client ID 未設定のため Gmail を使えません。',
      detail: 'VITE_GOOGLE_CLIENT_ID を設定して再読み込みしてください。',
    }
  }

  if (!gmailFeature.connection.signedIn) {
    return {
      summary: 'Gmail 接続待ちです。接続ボタンで認可してください。',
      detail: gmailFeature.connection.detail,
    }
  }

  if (gmailFeature.isBusy) {
    return { summary: 'Gmail データを同期中です。' }
  }

  if (gmailFeature.connection.state === 'error') {
    return {
      summary: 'Gmail 連携でエラーが発生しました。',
      detail: gmailFeature.connection.detail,
    }
  }

  if (gmailFeature.items.length === 0) {
    return { summary: 'Gmail から表示対象メッセージが返っていません。' }
  }

  return { summary: `Gmail ${gmailFeature.items.length}件を表示中です。` }
}

export default App
