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
    description: 'Runs on-device in supported Chrome environments through the Prompt API.',
    async checkAvailability() {
      if (!('LanguageModel' in globalThis)) {
        return {
          state: 'unavailable',
          summary: 'Prompt API was not detected in this browser.',
          detail: 'Use a supported Chrome desktop environment with built-in AI enabled.',
        }
      }

      try {
        const availability = await globalThis.LanguageModel.availability()

        switch (availability) {
          case 'available':
            return {
              state: 'ready',
              summary: 'Prompt API is ready to use in this browser.',
            }
          case 'downloadable':
          case 'downloading':
            return {
              state: 'downloadable',
              summary: 'The model is available but Chrome may need to download it first.',
            }
          default:
            return {
              state: 'unavailable',
              summary: 'Prompt API exists but the model is not available on this device.',
              detail: `Availability result: ${availability}`,
            }
        }
      } catch (error) {
        return {
          state: 'unavailable',
          summary: 'Prompt API detection failed.',
          detail: getErrorMessage(error),
        }
      }
    },
    async generate(request) {
      if (!('LanguageModel' in globalThis)) {
        throw new Error('Prompt API is not available in this browser.')
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
    description: 'Reserved for browser-local models when you decide which task-specific model to bundle.',
    async checkAvailability() {
      return {
        state: 'planned',
        summary: 'Provider slot is ready, but no model pipeline is bundled yet.',
        detail: 'Add a task-specific Transformers.js pipeline after the final theme is known.',
      }
    },
    async generate() {
      throw new Error('Transformers.js is not wired yet. Choose a model after the theme is announced.')
    },
  },
  {
    id: 'geminiApi',
    name: 'Gemini API',
    description: 'Cloud fallback for browsers where local AI is unavailable or not ready.',
    async checkAvailability() {
      if (!import.meta.env.VITE_GEMINI_API_KEY) {
        return {
          state: 'not-configured',
          summary: 'Add VITE_GEMINI_API_KEY to enable the cloud fallback provider.',
        }
      }

      return {
        state: 'ready',
        summary: `Configured to call ${defaultGeminiModel}.`,
      }
    },
    async generate(request) {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY

      if (!apiKey) {
        throw new Error('VITE_GEMINI_API_KEY is not set.')
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${defaultGeminiModel}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            systemInstruction: request.systemPrompt
              ? {
                  parts: [{ text: request.systemPrompt }],
                }
              : undefined,
            contents: [
              {
                role: 'user',
                parts: [{ text: request.prompt }],
              },
            ],
          }),
        },
      )

      if (!response.ok) {
        const detail = await response.text()
        throw new Error(`Gemini API request failed with ${response.status}: ${detail}`)
      }

      const data = (await response.json()) as GeminiGenerateContentResponse
      const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text).filter(Boolean).join('\n')

      if (!text) {
        throw new Error('Gemini API returned no text candidate.')
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
  const runnableStates: ProviderAvailabilityState[] = ['ready', 'downloadable']

  const preferredReady = preferredOrder.find((providerId) => {
    const availability = availabilityMap[providerId]
    return availability && runnableStates.includes(availability.state)
  })

  if (preferredReady) {
    return preferredReady
  }

  const firstKnown = preferredOrder.find((providerId) => availabilityMap[providerId])
  return firstKnown ?? null
}

export function getExecutionPlan(selectedProviderId: ProviderId, availabilityMap: AvailabilityMap): AIProvider[] {
  const runnableStates: ProviderAvailabilityState[] = ['ready', 'downloadable']
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
  return error instanceof Error ? error.message : 'Unknown error.'
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
