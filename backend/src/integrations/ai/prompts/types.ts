export const PROMPT_VERSION = 'v1' as const;

export type PromptVersion = typeof PROMPT_VERSION;

export interface BuiltPrompt {
  id: string;
  version: PromptVersion;
  system: string;
  prompt: string;
}

export interface VersionedPromptTemplate<TInput> {
  id: string;
  version: PromptVersion;
  build(input: TInput): BuiltPrompt;
}
