import { ValidationError } from '../errors';
import { confirmationRequired, describeSchema, FORBIDDEN_AI_TOOL_NAME } from '../integrations/ai/guardrails';
import { parseWithSchema } from '../schemas/parse';
import { copilotToolNameSchema } from './copilot.schemas';
import type { CopilotToolDescriptor, RegisteredCopilotTool } from './copilot.types';

export { describeSchema };

export class CopilotToolRegistry {
  private readonly tools = new Map<string, RegisteredCopilotTool>();

  register(tool: RegisteredCopilotTool): this {
    const name = parseWithSchema(copilotToolNameSchema, tool.name, {
      source: 'config',
      message: 'Invalid copilot tool name',
    });

    if (FORBIDDEN_AI_TOOL_NAME.test(name)) {
      throw new ValidationError('Copilot tools cannot expose arbitrary execution', [
        { path: 'config.name', message: `Tool "${name}" is not allowed`, code: 'custom' },
      ]);
    }

    if (!tool.description?.trim()) {
      throw new ValidationError('Copilot tools require a description', [
        { path: 'config.description', message: 'Description is required', code: 'custom' },
      ]);
    }

    if (this.tools.has(name)) {
      throw new ValidationError('Duplicate copilot tool', [
        { path: 'config.name', message: `Tool "${name}" is already registered`, code: 'custom' },
      ]);
    }

    this.tools.set(name, { ...tool, name });
    return this;
  }

  get(name: string): RegisteredCopilotTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): RegisteredCopilotTool[] {
    return [...this.tools.values()];
  }

  descriptors(): CopilotToolDescriptor[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      arguments: describeSchema(tool.inputSchema),
      requiredPermission: tool.requiredPermission,
      riskLevel: tool.riskLevel,
      actionKind: tool.actionKind,
      requiresConfirmation: confirmationRequired({
        riskLevel: tool.riskLevel,
        actionKind: tool.actionKind,
      }),
    }));
  }
}

export function createCopilotToolRegistry(tools: readonly RegisteredCopilotTool[] = []): CopilotToolRegistry {
  const registry = new CopilotToolRegistry();
  for (const tool of tools) {
    registry.register(tool);
  }
  return registry;
}
