export type GenerationJobStep = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
}

export const syncGenerationJobStep: GenerationJobStep = {
  run: async (_name, fn) => fn(),
}
