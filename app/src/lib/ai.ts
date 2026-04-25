export type ProviderId = 'browserBuiltIn' | 'transformersJs' | 'geminiApi'

export type ProviderAvailabilityState = 'ready' | 'downloadable' | 'unavailable' | 'not-configured' | 'planned'

export type ProviderAvailability = {
  state: ProviderAvailabilityState
  summary: string
  detail?: string
}

export type AIRequest = {
  prompt: string
  systemPrompt?: string
  allowCloudProcessing?: boolean
}

export type AIResponse = {
  text: string
  providerId: ProviderId
  providerName: string
  model: string
}

export type AIProvider = {
  id: ProviderId
  name: string
  description: string
  checkAvailability: () => Promise<ProviderAvailability>
  generate: (request: AIRequest) => Promise<AIResponse>
}

type AvailabilityMap = Partial<Record<ProviderId, ProviderAvailability>>

const defaultGeminiModel = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'

export const aiProviders: AIProvider[] = [
  {
    id: 'browserBuiltIn',
    name: 'Chrome Built-in AI',
    description: '対応した Chrome 環境で Prompt API を通じて端末上で実行します。',
    async checkAvailability() {
      if (!('LanguageModel' in globalThis)) {
        return {
          state: 'unavailable',
          summary: 'このブラウザでは Prompt API を検出できませんでした。',
          detail: 'Built-in AI を有効にした対応版 Chrome デスクトップ環境を利用してください。',
        }
      }

      try {
        const availability = await globalThis.LanguageModel.availability()

        switch (availability) {
          case 'available':
            return {
              state: 'ready',
              summary: 'このブラウザで Prompt API を利用できます。',
            }
          case 'downloadable':
          case 'downloading':
            return {
              state: 'downloadable',
              summary: '利用可能ですが、Chrome 側でモデルのダウンロードが必要な場合があります。',
            }
          default:
            return {
              state: 'unavailable',
              summary: 'Prompt API は存在しますが、この端末ではモデルを利用できません。',
              detail: `可用性結果: ${availability}`,
            }
        }
      } catch (error) {
        return {
          state: 'unavailable',
          summary: 'Prompt API の確認に失敗しました。',
          detail: getErrorMessage(error),
        }
      }
    },
    async generate(request) {
      if (!('LanguageModel' in globalThis)) {
        throw new Error('このブラウザでは Prompt API を利用できません。')
      }

      const session = await globalThis.LanguageModel.create({
        systemPrompt: request.systemPrompt,
      })

      try {
        const text = await session.prompt(request.prompt)

        return {
          text,
          providerId: 'browserBuiltIn',
          providerName: 'Chrome Built-in AI',
          model: 'Gemini Nano via Prompt API',
        }
      } finally {
        session.destroy?.()
      }
    },
  },
  {
    id: 'transformersJs',
    name: 'Transformers.js',
    description: 'タスクに応じたブラウザ内ローカルモデルを後から組み込むための予約枠です。',
    async checkAvailability() {
      return {
        state: 'planned',
        summary: '枠はありますが、まだモデルパイプラインは組み込まれていません。',
        detail: 'テーマ確定後に、用途に合った Transformers.js パイプラインを追加してください。',
      }
    },
    async generate() {
      throw new Error('Transformers.js はまだ接続されていません。テーマ確定後にモデルを選定してください。')
    },
  },
  {
    id: 'geminiApi',
    name: 'Gemini API',
    description: 'ローカルAIが使えない、または準備できていないブラウザ向けのクラウドフォールバックです。',
    async checkAvailability() {
      if (!import.meta.env.VITE_GEMINI_API_KEY) {
        return {
          state: 'not-configured',
          summary: 'クラウドフォールバックを有効にするには VITE_GEMINI_API_KEY を設定してください。',
        }
      }

      return {
        state: 'ready',
        summary: `${defaultGeminiModel} を呼び出す設定です。`,
      }
    },
    async generate(request) {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY

      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY が設定されていません。')
      }

      if (!request.allowCloudProcessing) {
        throw new Error('Gemini API を使うには、クラウド送信への同意を有効にしてください。')
      }

      const sanitizedPrompt = sanitizeForCloud(request.prompt)
      const sanitizedSystemPrompt = request.systemPrompt ? sanitizeForCloud(request.systemPrompt) : undefined

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${defaultGeminiModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: sanitizedSystemPrompt
              ? {
                  parts: [{ text: sanitizedSystemPrompt }],
                }
              : undefined,
            contents: [
              {
                role: 'user',
                parts: [{ text: sanitizedPrompt }],
              },
            ],
          }),
        },
      )

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Gemini API リクエストが ${response.status} で失敗しました: ${detail}`)
      }

      const data = (await response.json()) as GeminiGenerateContentResponse
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n')

      if (!text) {
        throw new Error('Gemini API からテキスト候補が返りませんでした。')
      }

      return {
        text,
        providerId: 'geminiApi',
        providerName: 'Gemini API',
        model: defaultGeminiModel,
      }
    },
  },
]

export function getPreferredProviderId(availabilityMap: AvailabilityMap): ProviderId | null {
  const preferredOrder: ProviderId[] = ['browserBuiltIn', 'geminiApi', 'transformersJs']
  const runnableStates: ProviderAvailabilityState[] = ['ready']

  const preferredReady = preferredOrder.find((providerId) => {
    const availability = availabilityMap[providerId]
    return availability && runnableStates.includes(availability.state)
  })

  if (preferredReady) {
    return preferredReady
  }

  const firstKnown = preferredOrder.find((providerId) => {
    const availability = availabilityMap[providerId]
    return availability && availability.state !== 'planned'
  })
  return firstKnown ?? null
}

export function getExecutionPlan(selectedProviderId: ProviderId, availabilityMap: AvailabilityMap): AIProvider[] {
  const runnableStates: ProviderAvailabilityState[] = ['ready']
  const orderedIds: ProviderId[] = [
    selectedProviderId,
    ...aiProviders.map((provider) => provider.id).filter((providerId) => providerId !== selectedProviderId),
  ]

  return orderedIds
    .filter((providerId, index) => orderedIds.indexOf(providerId) === index)
    .filter((providerId) => {
      const availability = availabilityMap[providerId]
      return availability && runnableStates.includes(availability.state)
    })
    .map((providerId) => aiProviders.find((provider) => provider.id === providerId))
    .filter((provider): provider is AIProvider => Boolean(provider))
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : '不明なエラーです。'
}

function sanitizeForCloud(text: string) {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
    .replace(/\b\d{2,4}[-\s]?\d{2,4}[-\s]?\d{3,4}\b/g, '[redacted-phone]')
    .replace(/https?:\/\/\S+/gi, '[redacted-url]')
}

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}
