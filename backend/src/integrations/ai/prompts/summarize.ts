import type { AiSummarizeInput } from '../ai.types';
import { resolveDocumentContent } from '../ai.schemas';
import { wrapUntrustedData } from '../guardrails';
import { withSafetySystem } from './safety';
import { PROMPT_VERSION, type BuiltPrompt, type VersionedPromptTemplate } from './types';

export function buildSummarizePrompt(input: AiSummarizeInput): BuiltPrompt {
  const content = resolveDocumentContent(input);
  const style = input.style ?? 'brief';
  const length = input.length ?? (input.maxSentences === 1 ? 'short' : 'medium');
  const language = input.language ? ` Write the summary in ${input.language}.` : '';
  const sentenceBound = input.maxSentences
    ? ` Use at most ${input.maxSentences} sentence${input.maxSentences === 1 ? '' : 's'} in the summary field.`
    : '';

  return {
    id: 'summarize',
    version: PROMPT_VERSION,
    system: withSafetySystem(
      'You summarize text for an application backend. Ground every point in the provided content. Do not invent facts.',
    ),
    prompt: `Summarize the following content.
Style: ${style}
Length: ${length}${language}${sentenceBound}

Return JSON with this shape:
{"summary":"...","keyPoints":["..."],"actions":["..."]}

"actions" are follow-up actions implied by the content. Use an empty array when none are present.

Content:
${wrapUntrustedData('document', content)}`,
  };
}

export const SUMMARIZE_PROMPT: VersionedPromptTemplate<AiSummarizeInput> = {
  id: 'summarize',
  version: PROMPT_VERSION,
  build: buildSummarizePrompt,
};
