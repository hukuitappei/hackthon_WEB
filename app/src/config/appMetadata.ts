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
  teamName: 'TBD Team',
  teamNameKana: 'てぃーびーでぃーちーむ',
  workTitle: 'Hackathon Base App',
  workTitleKana: 'はっかそんべーすあぷり',
  workUrl: 'https://example.com',
  toolsUsed: ['React', 'Vite', 'TypeScript', 'Chrome Built-in AI', 'Transformers.js', 'Gemini API'],
}

export const foundationGoals = [
  {
    title: 'Chrome-safe demo path',
    description: 'Keep the product usable as a browser app first so submission and judging do not depend on extra setup.',
  },
  {
    title: 'Fast theme pivot',
    description: 'Reserve clear feature slots so the final theme can replace placeholder content without reworking the shell.',
  },
  {
    title: 'Visible AI usage',
    description: 'Surface multiple AI routes early so the project can demonstrate both implementation depth and AI utilization.',
  },
]

export const workspaceSlots: FeatureSlot[] = [
  {
    tag: 'Primary Flow',
    title: 'User-facing core interaction',
    description: 'Place the main theme-specific experience here once the hackathon prompt is announced.',
    placeholder: 'Example: input -> AI assist -> result card -> share/export action',
  },
  {
    tag: 'Signal Layer',
    title: 'AI insight or transformation panel',
    description: 'Use this slot for summarization, idea generation, translation, classification, or other AI output tied to the theme.',
    placeholder: 'Example: summarize meeting notes, rank options, or rewrite text for the target audience',
  },
  {
    tag: 'Demo Support',
    title: 'Narrative and fallback area',
    description: 'Keep a place for explainability, fallback messaging, and what the user should do when a provider is unavailable.',
    placeholder: 'Example: provider state, last response source, and “why this is useful” summary',
  },
]

export const submissionChecklist = [
  'Finalize team name and reading',
  'Finalize work title and reading',
  'Replace placeholder production URL',
  'Confirm the tools used list before form submission',
]
