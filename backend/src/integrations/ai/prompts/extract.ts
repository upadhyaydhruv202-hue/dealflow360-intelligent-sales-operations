import type { AiExtractInput } from '../ai.types';
import { resolveDocumentContent } from '../ai.schemas';
import { wrapUntrustedData } from '../guardrails';
import { withSafetySystem } from './safety';
import { PROMPT_VERSION, type BuiltPrompt, type VersionedPromptTemplate } from './types';

export function buildExtractPrompt(input: AiExtractInput): BuiltPrompt {
  const content = resolveDocumentContent(input);
  const schemaName = input.schemaName ?? 'fields';
  const shape = extractShape(schemaName, input.fields ?? []);

  return {
    id: 'extract',
    version: PROMPT_VERSION,
    system: withSafetySystem(
      'You extract structured data for an application backend. Use null for missing scalar fields. Do not invent identifiers, dates, or amounts. Set requiresReview to true when values are uncertain or missing.',
    ),
    prompt: `Extract structured data from the content using schema "${schemaName}".

Return JSON with this shape:
${shape}

List missing field names in missingFields. Confidence is from 0 to 1. Warnings explain uncertainty. requiresReview must be true when confidence is low or fields are missing.

Content:
${wrapUntrustedData('document', content)}`,
  };
}

export const EXTRACT_PROMPT: VersionedPromptTemplate<AiExtractInput> = {
  id: 'extract',
  version: PROMPT_VERSION,
  build: buildExtractPrompt,
};

function extractShape(schemaName: string, fields: string[]): string {
  if (schemaName === 'entities') {
    return `{"fields":{"people":[],"organizations":[],"locations":[],"dates":[],"amounts":[],"identifiers":[]},"missingFields":[],"confidence":0.0,"warnings":[],"requiresReview":false}`;
  }

  if (schemaName === 'actionItems') {
    return `{"fields":{"actionItems":[{"action":"...","owner":null,"due":null,"priority":"low"|"medium"|"high"}]},"missingFields":[],"confidence":0.0,"warnings":[],"requiresReview":false}`;
  }

  const keys = fields.map((field) => `"${field}":null`).join(',');
  return `{"fields":{${keys}},"missingFields":[],"confidence":0.0,"warnings":[],"requiresReview":false}`;
}
