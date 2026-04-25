import { useEffect, useState } from 'react'
import './App.css'
import { appMetadata, foundationGoals, submissionChecklist, workspaceSlots } from './config/appMetadata'
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
  ready: 'Available',
  downloadable: 'Download required',
  unavailable: 'Unavailable',
  'not-configured': 'Not configured',
  planned: 'Planned slot',
}

const samplePrompt = [
  'Hackathon theme is not decided yet.',
  'Propose three lightweight AI-driven web app directions that fit Chrome and a short team build window.',
  'Each idea should include the user value and one bold implementation angle.',
].join(' ')

function App() {
  const [availabilityMap, setAvailabilityMap] = useState<AvailabilityMap>({})
  const [selectedProviderId, setSelectedProviderId] = useState<ProviderId>('browserBuiltIn')
  const [prompt, setPrompt] = useState(samplePrompt)
  const [result, setResult] = useState<AIResponse | null>(null)
  const [executionNote, setExecutionNote] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [isCheckingProviders, setIsCheckingProviders] = useState(true)
  const [isRunning, setIsRunning] = useState(false)

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

  async function handleRunPrompt() {
    setIsRunning(true)
    setError('')
    setResult(null)

    const executionPlan = getExecutionPlan(selectedProviderId, availabilityMap)

    if (executionPlan.length === 0) {
      setExecutionNote('No provider is ready. Configure Gemini or use Chrome built-in AI on a supported device.')
      setError('No runnable provider is currently available.')
      setIsRunning(false)
      return
    }

    const planLabel = executionPlan.map((provider) => provider.name).join(' -> ')
    setExecutionNote(`Execution path: ${planLabel}`)

    for (const provider of executionPlan) {
      try {
        const response = await provider.generate({
          prompt,
          systemPrompt:
            'You are a hackathon co-designer. Keep the answer concise, practical, and demo-friendly.',
        })
        setResult(response)
        setExecutionNote(
          provider.id === selectedProviderId
            ? `Ran with ${provider.name}.`
            : `Selected ${findProvider(selectedProviderId)?.name ?? selectedProviderId} was skipped or failed, so the app fell back to ${provider.name}.`,
        )
        setIsRunning(false)
        return
      } catch (providerError) {
        const detail = providerError instanceof Error ? providerError.message : 'Unknown generation error.'
        setError(`Provider ${provider.name} failed: ${detail}`)
      }
    }

    setIsRunning(false)
  }

  const recommendedProviderId = getPreferredProviderId(availabilityMap)

  return (
    <div className="app-shell">
      <header className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Chrome-first Hackathon Foundation</p>
          <h1>Theme-agnostic AI web app base for fast day-of execution.</h1>
          <p className="hero-summary">
            This starter keeps the structure stable while the feature idea changes. The shell is ready for a final
            theme workspace, provider switching, and submission prep.
          </p>
        </div>
        <div className="hero-status">
          <div className="stat-card">
            <span className="stat-label">Stack</span>
            <strong>React + Vite + TypeScript</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Preferred AI path</span>
            <strong>{recommendedProviderId ? findProvider(recommendedProviderId)?.name : 'Checking providers'}</strong>
          </div>
          <div className="stat-card">
            <span className="stat-label">Hosting target</span>
            <strong>Static deploy first</strong>
          </div>
        </div>
      </header>

      <main className="dashboard">
        <section className="panel panel-workspace">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Theme Workspace</p>
              <h2>Swap in the final feature without touching the shell.</h2>
            </div>
            <span className="pill">Feature slots ready</span>
          </div>

          <div className="goal-grid">
            {foundationGoals.map((goal) => (
              <article key={goal.title} className="goal-card">
                <h3>{goal.title}</h3>
                <p>{goal.description}</p>
              </article>
            ))}
          </div>

          <div className="slot-list">
            {workspaceSlots.map((slot) => (
              <article key={slot.title} className="slot-card">
                <div className="slot-copy">
                  <p className="slot-tag">{slot.tag}</p>
                  <h3>{slot.title}</h3>
                  <p>{slot.description}</p>
                </div>
                <p className="slot-example">{slot.placeholder}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="panel panel-ai">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">AI Playground</p>
              <h2>Verify browser, local, and API execution paths in one place.</h2>
            </div>
            <span className="pill pill-accent">{isCheckingProviders ? 'Checking providers' : 'Provider matrix loaded'}</span>
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
                  <small>{availability?.summary ?? 'Checking provider availability.'}</small>
                </label>
              )
            })}
          </div>

          <div className="playground">
            <label className="prompt-field">
              <span>Prompt</span>
              <textarea
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Describe the kind of help you want from the AI layer."
                rows={7}
                value={prompt}
              />
            </label>

            <div className="playground-actions">
              <button className="run-button" disabled={isRunning || prompt.trim().length === 0} onClick={() => void handleRunPrompt()} type="button">
                {isRunning ? 'Running...' : 'Run sample task'}
              </button>
              <p className="execution-note">{executionNote || 'The app will try the selected provider first, then fall back to another ready path.'}</p>
            </div>

            <div className="result-card">
              <div className="result-header">
                <h3>Result</h3>
                {result ? <span className="pill">{result.providerName}</span> : null}
              </div>
              {error ? <p className="error-text">{error}</p> : null}
              {result ? <p className="result-text">{result.text}</p> : <p className="result-placeholder">No output yet. Use this panel to smoke-test the current AI path.</p>}
            </div>
          </div>
        </section>

        <section className="panel panel-project">
          <div className="panel-header">
            <div>
              <p className="panel-kicker">Project Info</p>
              <h2>Keep final submission inputs visible while building.</h2>
            </div>
            <span className="pill">Submission-ready fields</span>
          </div>

          <div className="metadata-grid">
            <article className="metadata-card">
              <h3>App metadata</h3>
              <dl>
                <div>
                  <dt>Team name</dt>
                  <dd>{appMetadata.teamName}</dd>
                </div>
                <div>
                  <dt>Team kana</dt>
                  <dd>{appMetadata.teamNameKana}</dd>
                </div>
                <div>
                  <dt>Work title</dt>
                  <dd>{appMetadata.workTitle}</dd>
                </div>
                <div>
                  <dt>Work URL</dt>
                  <dd>{appMetadata.workUrl}</dd>
                </div>
              </dl>
            </article>

            <article className="metadata-card">
              <h3>Tools used</h3>
              <ul className="tool-list">
                {appMetadata.toolsUsed.map((tool) => (
                  <li key={tool}>{tool}</li>
                ))}
              </ul>
            </article>
          </div>

          <article className="checklist-card">
            <h3>Submission checklist</h3>
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

export default App
