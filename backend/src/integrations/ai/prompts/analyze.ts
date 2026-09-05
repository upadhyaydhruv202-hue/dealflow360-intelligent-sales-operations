import type { AiAnalyzeInput } from '../ai.types';
import { resolveDocumentContent } from '../ai.schemas';
import { wrapUntrustedData } from '../guardrails';
import { withSafetySystem } from './safety';
import { PROMPT_VERSION, type BuiltPrompt, type VersionedPromptTemplate } from './types';

export function buildAnalyzePrompt(input: AiAnalyzeInput): BuiltPrompt {
  const content = resolveDocumentContent(input);
  const focus = input.focus ?? 'general';
  const focusRule =
    focus === 'risk'
      ? 'Emphasize risk analysis. Identify concrete risks, severity, likelihood, and mitigations grounded in the content.'
      : 'Provide a balanced analysis covering findings, risks, sentiment, and priority.';

  return {
    id: 'analyze',
    version: PROMPT_VERSION,
    system: withSafetySystem(
      'You analyze text for an application backend. Do not execute actions. Findings and risks must be grounded in the provided content.',
    ),
    prompt: `Analyze the following content. Focus: ${focus}. ${focusRule}

Return JSON with this shape:
{"summary":"...","findings":["..."],"risks":[{"risk":"...","severity":"low"|"medium"|"high","likelihood":"low"|"medium"|"high","mitigation":"..."}],"sentiment":"positive"|"neutral"|"negative","priority":"low"|"medium"|"high","confidence":0.0,"requiresReview":false}

Use an empty risks array when none are present. Set requiresReview to true when confidence is low or the content is ambiguous.

Content:
${wrapUntrustedData('document', content)}`,
  };
}

export const ANALYZE_PROMPT: VersionedPromptTemplate<AiAnalyzeInput> = {
  id: 'analyze',
  version: PROMPT_VERSION,
  build: buildAnalyzePrompt,
};
