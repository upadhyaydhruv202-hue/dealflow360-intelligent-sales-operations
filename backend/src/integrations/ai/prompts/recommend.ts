import type { AiRecommendInput } from '../ai.types';
import { resolveRecommendContext } from '../ai.schemas';
import { wrapUntrustedData } from '../guardrails';
import { withSafetySystem } from './safety';
import { PROMPT_VERSION, type BuiltPrompt, type VersionedPromptTemplate } from './types';

export function buildRecommendPrompt(input: AiRecommendInput): BuiltPrompt {
  const context = resolveRecommendContext(input);
  const limit = input.limit ?? 3;
  const goal = input.goal ? `\nGoal: ${input.goal}` : '';

  return {
    id: 'recommend',
    version: PROMPT_VERSION,
    system: withSafetySystem(
      'You recommend next steps for an application backend. Recommendations are suggestions, not executable actions. Cite evidence from the provided context when available.',
    ),
    prompt: `Given the context, produce ${limit} practical recommendation${limit === 1 ? '' : 's'}.${goal}

Return JSON with this shape:
{"recommendations":[{"recommendation":"...","reason":"...","evidence":"...","confidence":0.0}]}

Confidence is from 0 to 1. Omit evidence only when the context does not support a citation.

Context:
${wrapUntrustedData('user', context)}`,
  };
}

export const RECOMMEND_PROMPT: VersionedPromptTemplate<AiRecommendInput> = {
  id: 'recommend',
  version: PROMPT_VERSION,
  build: buildRecommendPrompt,
};
