import type { AIService } from '../integrations/ai';
import { parseAiOutput } from '../schemas/parse';
import { copilotPlanSchema } from './copilot.schemas';
import type { CopilotPlan, CopilotToolDescriptor } from './copilot.types';
import { buildCopilotPlanPrompt } from './prompts/plan';

export async function planCopilotTurn(options: {
  ai: AIService;
  message: string;
  history: Array<{ role: string; content: string }>;
  tools: CopilotToolDescriptor[];
}): Promise<CopilotPlan> {
  const prompt = buildCopilotPlanPrompt(options);
  const result = await options.ai.generateStructured({
    system: prompt.system,
    prompt: prompt.prompt,
    schema: copilotPlanSchema,
    schemaName: 'copilotPlan',
    temperature: 0.1,
  });

  return parseAiOutput(copilotPlanSchema, result.data);
}
