import type { AiClassifyInput } from '../ai.types';
import { resolveDocumentContent } from '../ai.schemas';
import { wrapUntrustedData } from '../guardrails';
import { withSafetySystem } from './safety';
import { PROMPT_VERSION, type BuiltPrompt, type VersionedPromptTemplate } from './types';

export function buildClassifyPrompt(input: AiClassifyInput): BuiltPrompt {
  const content = resolveDocumentContent(input);
  const labels = input.labels ?? [];
  const categoryRule = labels.length
    ? `The category must be exactly one of: ${labels.map((label) => `"${label}"`).join(', ')}.`
    : 'Choose a short category identifier (letters, numbers, underscore, or hyphen).';

  return {
    id: 'classify',
    version: PROMPT_VERSION,
    system: withSafetySystem(
      'You classify text for an application backend. Include category, priority, sentiment, confidence, and reason. Priority and sentiment must be grounded in the content.',
    ),
    prompt: `Classify the following content. ${categoryRule}

Return JSON with this shape:
{"category":"...","priority":"low"|"medium"|"high","sentiment":"positive"|"neutral"|"negative","confidence":0.0,"reason":"<short reason>"}

Confidence is from 0 to 1. Use a lower confidence when the content is ambiguous.

Content:
${wrapUntrustedData('document', content)}`,
  };
}

export const CLASSIFY_PROMPT: VersionedPromptTemplate<AiClassifyInput> = {
  id: 'classify',
  version: PROMPT_VERSION,
  build: buildClassifyPrompt,
};
