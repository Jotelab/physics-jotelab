export type GenerationJobStep = {
  run: <T>(name: string, fn: () => Promise<T>) => Promise<T>
}

export const syncGenerationJobStep: GenerationJobStep = {
  run: async (_name, fn) => fn(),
}

/**
 * The single `run(name, fn)` call shape the workers use from an Inngest `step`.
 *
 * Inngest's real `step.run` is a broader generic — its first argument also
 * accepts a `StepOptions` object, it threads rest input through, and it applies
 * any middleware output transforms — so the whole `step` object is not
 * structurally assignable to {@link GenerationJobStep} even though every
 * `run(name, fn)` call we make is compatible.
 */
type InngestStepRunner = {
  run: (idOrName: string, fn: () => Promise<unknown>) => Promise<unknown>
}

/**
 * Adapt an Inngest `step` to the narrow {@link GenerationJobStep} contract used
 * by the generation workers.
 *
 * This replaces a call-site `step as unknown as GenerationJobStep` with one
 * typed boundary: each delegated `run` returns `Promise<T>` to the caller, and
 * the lone assertion narrows Inngest's `Promise<unknown>` back to the awaited
 * result of `fn` — which is exactly what `step.run(name, fn)` resolves to at
 * runtime (this project registers no output-transforming middleware).
 */
export function toGenerationJobStep(step: InngestStepRunner): GenerationJobStep {
  return {
    run: (name, fn) => step.run(name, fn) as ReturnType<typeof fn>,
  }
}
