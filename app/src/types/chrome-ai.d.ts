declare global {
  interface LanguageModelCreateOptions {
    systemPrompt?: string
  }

  interface LanguageModelSession {
    prompt(input: string): Promise<string>
    destroy?(): void
  }

  interface LanguageModelStatic {
    availability(
      options?: LanguageModelCreateOptions,
    ): Promise<'available' | 'downloadable' | 'downloading' | 'unavailable'>
    create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>
  }

  var LanguageModel: LanguageModelStatic
}

export {}
