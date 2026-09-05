import type { AIService } from '../integrations/ai';
import { parseAiOutput } from '../schemas/parse';
import type { IntentRegistry } from './intents.registry';
import { intentExtractSchema } from './intents.schemas';
import type { ExtractedIntentCommand } from './intents.types';
import { buildIntentExtractPrompt } from './prompts/extract';

export async function extractIntentCommand(options: {
  ai: AIService;
  utterance: string;
  registry: IntentRegistry;
}): Promise<ExtractedIntentCommand> {
  const prompt = buildIntentExtractPrompt({
    utterance: options.utterance,
    intents: options.registry.descriptors(),
  });
  const result = await options.ai.generateStructured({
    system: prompt.system,
    prompt: prompt.prompt,
    schema: intentExtractSchema,
    schemaName: 'intentCommand',
    temperature: 0.1,
  });

  const parsed = parseAiOutput(intentExtractSchema, result.data);
  return {
    intent: parsed.intent,
    input: parsed.input,
    confidence: parsed.confidence,
    evidence: parsed.evidence,
    ambiguous: parsed.ambiguous,
    candidates: parsed.candidates,
    clarification: parsed.clarification,
  };
}
