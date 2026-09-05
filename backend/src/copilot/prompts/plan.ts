import { AI_JSON_INSTRUCTION, AI_SAFETY_PREAMBLE, PROMPT_VERSION, type BuiltPrompt } from '../../integrations/ai/prompts';
import { wrapUntrustedData } from '../../integrations/ai/guardrails';
import type { CopilotToolDescriptor } from '../copilot.types';

export function buildCopilotPlanPrompt(input: {
  message: string;
  history: Array<{ role: string; content: string }>;
  tools: CopilotToolDescriptor[];
}): BuiltPrompt {
  const catalog = input.tools.length
    ? input.tools
        .map(
          (tool) =>
            `- ${tool.name}: ${tool.description} Args: ${JSON.stringify(tool.arguments)}. Permission: ${tool.requiredPermission}. Risk: ${tool.riskLevel}.${tool.requiresConfirmation ? ' Requires confirmation.' : ''}`,
        )
        .join('\n')
    : '(no tools registered)';

  const history =
    input.history.length === 0
      ? '(none)'
      : wrapUntrustedData(
          'user',
          input.history.map((item) => `${item.role}: ${item.content}`).join('\n'),
        );

  return {
    id: 'copilot.plan',
    version: PROMPT_VERSION,
    system: `${AI_SAFETY_PREAMBLE}
You are a controlled application copilot. You may answer questions or propose tools from the allowlist only.
Never invent tools. Never propose SQL, JavaScript, shell commands, arbitrary HTTP requests, or arbitrary Odoo methods.
If the user asks for a high-risk action, still propose the allowlisted tool; the application will require confirmation.
If no tool is needed, set intent to "answer". If you need a missing identifier, set intent to "clarify".
${AI_JSON_INSTRUCTION}

Return JSON with this shape:
{"intent":"answer"|"tool"|"clarify","reply":"...","tools":[{"name":"toolName","arguments":{}}],"confidence":0.0,"evidence":"optional"}`,
    prompt: `Allowed tools:
${catalog}

Conversation history:
${history}

Current user message:
${wrapUntrustedData('user', input.message)}`,
  };
}
