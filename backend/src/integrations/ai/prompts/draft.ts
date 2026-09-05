import type { AiDraftInput } from '../ai.types';
import { resolveDocumentContent } from '../ai.schemas';
import { wrapUntrustedData } from '../guardrails';
import { withSafetySystem } from './safety';
import { PROMPT_VERSION, type BuiltPrompt, type VersionedPromptTemplate } from './types';

export function buildDraftPrompt(input: AiDraftInput): BuiltPrompt {
  const content = resolveDocumentContent(input);
  const tone = input.tone ?? 'neutral';
  const purpose = input.purpose ? `\nPurpose: ${input.purpose}` : '';
  const audience = input.audience ? `\nAudience: ${input.audience}` : '';
  const language = input.language ? `\nLanguage: ${input.language}` : '';

  return {
    id: 'draft',
    version: PROMPT_VERSION,
    system: withSafetySystem(
      'You draft a response for a human to review before sending. Do not claim the draft was sent. Do not include credentials, SQL, code, or shell commands. requiresReview must be true.',
    ),
    prompt: `Draft a response based on the following content.
Tone: ${tone}${purpose}${audience}${language}

Return JSON with this shape:
{"draft":"...","subject":"...","alternatives":["..."],"warnings":["..."],"confidence":0.0,"requiresReview":true}

"subject" is optional. alternatives may be empty. warnings should note tone risk, missing facts, or anything a human should check.

Content:
${wrapUntrustedData('document', content)}`,
  };
}

export const DRAFT_PROMPT: VersionedPromptTemplate<AiDraftInput> = {
  id: 'draft',
  version: PROMPT_VERSION,
  build: buildDraftPrompt,
};
