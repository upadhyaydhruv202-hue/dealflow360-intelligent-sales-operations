import { AI_JSON_INSTRUCTION, AI_SAFETY_PREAMBLE, PROMPT_VERSION, type BuiltPrompt } from '../../integrations/ai/prompts';
import { wrapUntrustedData } from '../../integrations/ai/guardrails';
import type { IntentDescriptor } from '../intents.types';

export function buildIntentExtractPrompt(input: {
  utterance: string;
  intents: IntentDescriptor[];
}): BuiltPrompt {
  const catalog = input.intents.length
    ? input.intents
        .map(
          (intent) =>
            `- ${intent.name}: ${intent.description} Args: ${JSON.stringify(intent.arguments)}. Permission: ${intent.requiredPermission}. Risk: ${intent.riskLevel}.${intent.requiresConfirmation ? ' Requires confirmation.' : ''}${intent.examples.length ? ` Examples: ${intent.examples.join(' | ')}` : ''}`,
        )
        .join('\n')
    : '(no intents registered)';

  return {
    id: 'intent.extract',
    version: PROMPT_VERSION,
    system: `${AI_SAFETY_PREAMBLE}
You convert a user's natural-language business request into one structured command from the allowlist.
Never invent intents. Never produce SQL, JavaScript, shell commands, arbitrary HTTP requests, or arbitrary Odoo methods.
If the request is unclear, maps to more than one intent, or is missing a required identifier, set intent to "UNKNOWN" and ambiguous to true.
Do not execute anything. Return JSON only.
${AI_JSON_INSTRUCTION}

Return JSON with this shape:
{"intent":"SEARCH_ORDERS"|"UNKNOWN","input":{},"confidence":0.0,"evidence":"optional","ambiguous":false,"candidates":[],"clarification":"optional"}`,
    prompt: `Allowed intents:
${catalog}

User request:
${wrapUntrustedData('user', input.utterance)}`,
  };
}
