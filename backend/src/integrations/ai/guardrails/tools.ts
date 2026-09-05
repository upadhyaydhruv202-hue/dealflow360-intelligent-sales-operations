import { z, type ZodTypeAny } from 'zod';

import type { AuditService } from '../../../audit/audit.service';
import { AppError, AuthorizationError, ValidationError } from '../../../errors';
import { sanitizeErrorMessage } from '../../../errors/sanitize';
import { hasPermission } from '../../../rbac/authorize';
import { parseWithSchema } from '../../../schemas/parse';
import type { AppLogger } from '../../../utils/logger';
import { getRequestId } from '../../../utils/request-context';
import { AI_AUDIT_ACTIONS, recordAiAudit } from './audit';
import { confirmationRequired, trustExplicitConfirmation } from './confirmation';
import { redactSensitiveValue, truncateJson } from './redaction';
import type {
  AiRiskLevel,
  AiToolDescriptor,
  AiToolExecution,
  AiToolResolver,
  RegisteredAiTool,
} from './types';

export const aiToolNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-zA-Z0-9]*$/, 'Tool names must be camelCase identifiers');

export const FORBIDDEN_AI_TOOL_NAME =
  /^(eval|exec|executeSql|executeOdoo|sql|queryRaw|rawQuery|shell|bash|sh|cmd|powershell|spawn|fork|http|fetch|curl|request|subprocess)($|[A-Z._-])/i;

export class AiToolRegistry implements AiToolResolver {
  private readonly tools = new Map<string, RegisteredAiTool>();

  register(tool: RegisteredAiTool): this {
    const name = parseWithSchema(aiToolNameSchema, tool.name, {
      source: 'config',
      message: 'Invalid AI tool name',
    });

    if (FORBIDDEN_AI_TOOL_NAME.test(name)) {
      throw new ValidationError('AI tools cannot expose arbitrary execution', [
        { path: 'config.name', message: `Tool "${name}" is not allowed`, code: 'custom' },
      ]);
    }

    if (!tool.description?.trim()) {
      throw new ValidationError('AI tools require a description', [
        { path: 'config.description', message: 'Description is required', code: 'custom' },
      ]);
    }

    if (!tool.requiredPermission?.trim()) {
      throw new ValidationError('AI tools require a permission', [
        { path: 'config.requiredPermission', message: 'Permission is required', code: 'custom' },
      ]);
    }

    if (!tool.inputSchema) {
      throw new ValidationError('AI tools require an input schema', [
        { path: 'config.inputSchema', message: 'Schema is required', code: 'custom' },
      ]);
    }

    if (!tool.handler) {
      throw new ValidationError('AI tools require a handler', [
        { path: 'config.handler', message: 'Handler is required', code: 'custom' },
      ]);
    }

    if (this.tools.has(name)) {
      throw new ValidationError('Duplicate AI tool', [
        { path: 'config.name', message: `Tool "${name}" is already registered`, code: 'custom' },
      ]);
    }

    this.tools.set(name, { ...tool, name });
    return this;
  }

  get(name: string): RegisteredAiTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): RegisteredAiTool[] {
    return [...this.tools.values()];
  }

  descriptors(): AiToolDescriptor[] {
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

export function createAiToolRegistry(tools: readonly RegisteredAiTool[] = []): AiToolRegistry {
  const registry = new AiToolRegistry();
  for (const tool of tools) {
    registry.register(tool);
  }
  return registry;
}

export async function executeAiTool(options: {
  registry: AiToolResolver;
  name: string;
  args: unknown;
  user: import('../../../auth/types').AuthenticatedUser;
  confirmed: boolean;
  conversationId?: string;
  plannerConfidence?: number;
  audit?: AuditService | null;
  auditAction?: string;
  logger?: AppLogger;
  fallbackRiskLevel?: AiRiskLevel;
}): Promise<AiToolExecution> {
  const requestId = getRequestId();
  const args = asArgumentRecord(options.args);
  const tool = options.registry.get(options.name);

  if (!tool) {
    return finishTool({
      name: options.name,
      arguments: args,
      status: 'denied',
      riskLevel: options.fallbackRiskLevel ?? 'high',
      error: 'Tool is not in the allowlist',
      userId: options.user.id,
      requestId,
      audit: options.audit,
      auditAction: options.auditAction,
    });
  }

  if (!hasPermission(options.user, tool.requiredPermission)) {
    return finishTool({
      name: tool.name,
      arguments: args,
      status: 'denied',
      riskLevel: tool.riskLevel,
      actionKind: tool.actionKind,
      error: 'You are not allowed to use this tool',
      userId: options.user.id,
      requestId,
      audit: options.audit,
      auditAction: options.auditAction,
    });
  }

  const parsed = tool.inputSchema.safeParse(args);
  if (!parsed.success) {
    return finishTool({
      name: tool.name,
      arguments: args,
      status: 'invalid_arguments',
      riskLevel: tool.riskLevel,
      actionKind: tool.actionKind,
      error: 'Tool arguments failed schema validation',
      userId: options.user.id,
      requestId,
      audit: options.audit,
      auditAction: options.auditAction,
    });
  }

  const required = confirmationRequired({
    riskLevel: tool.riskLevel,
    actionKind: tool.actionKind,
    needsConfirmation: tool.needsConfirmation?.(parsed.data) === true,
    plannerConfidence: options.plannerConfidence,
  });

  if (required && !trustExplicitConfirmation(options.confirmed)) {
    return finishTool({
      name: tool.name,
      arguments: args,
      status: 'pending_confirmation',
      riskLevel: tool.riskLevel,
      actionKind: tool.actionKind,
      result: { requiresConfirmation: true },
      userId: options.user.id,
      requestId,
      audit: options.audit,
      auditAction: options.auditAction,
    });
  }

  try {
    const raw = await tool.handler(parsed.data, {
      user: options.user,
      conversationId: options.conversationId,
      requestId,
      confirmed: options.confirmed,
    });
    const result = tool.outputSchema ? parseWithSchema(tool.outputSchema, raw) : raw;
    return finishTool({
      name: tool.name,
      arguments: args,
      status: 'success',
      riskLevel: tool.riskLevel,
      actionKind: tool.actionKind,
      result: truncateJson(result),
      userId: options.user.id,
      requestId,
      audit: options.audit,
      auditAction: options.auditAction,
    });
  } catch (error) {
    options.logger?.warn({ err: error, tool: tool.name, requestId }, 'AI tool failed');
    return finishTool({
      name: tool.name,
      arguments: args,
      status: 'failed',
      riskLevel: tool.riskLevel,
      actionKind: tool.actionKind,
      error: sanitizeToolError(error),
      userId: options.user.id,
      requestId,
      audit: options.audit,
      auditAction: options.auditAction,
    });
  }
}

async function finishTool(input: {
  name: string;
  arguments: Record<string, unknown>;
  status: AiToolExecution['status'];
  riskLevel: AiRiskLevel;
  actionKind?: AiToolExecution['actionKind'];
  result?: unknown;
  error?: string;
  userId: string;
  requestId?: string;
  audit?: AuditService | null;
  auditAction?: string;
}): Promise<AiToolExecution> {
  await recordAiAudit(input.audit, {
    userId: input.userId,
    action: input.auditAction ?? AI_AUDIT_ACTIONS.tool,
    resource: input.name,
    request: redactSensitiveValue(input.arguments),
    status: input.status,
    requestId: input.requestId,
  });

  return {
    name: input.name,
    arguments: (redactSensitiveValue(input.arguments) as Record<string, unknown>) ?? {},
    status: input.status,
    riskLevel: input.riskLevel,
    actionKind: input.actionKind,
    result: input.result,
    error: input.error,
  };
}

export function describeSchema(schema: ZodTypeAny): Record<string, string> {
  const objectSchema = unwrapObject(schema);
  if (!objectSchema) {
    return { value: describeType(schema) };
  }

  return Object.fromEntries(
    Object.entries(objectSchema.shape).map(([key, value]) => [key, describeType(value as ZodTypeAny)]),
  );
}

function unwrapObject(schema: ZodTypeAny): z.ZodObject<z.ZodRawShape> | null {
  let current: ZodTypeAny = schema;
  for (let i = 0; i < 6; i += 1) {
    if (current instanceof z.ZodObject) {
      return current;
    }

    const def = current._def as { typeName?: string; innerType?: ZodTypeAny; schema?: ZodTypeAny };
    if (def.innerType) {
      current = def.innerType;
      continue;
    }

    if (def.schema) {
      current = def.schema;
      continue;
    }

    return null;
  }

  return null;
}

function describeType(schema: ZodTypeAny): string {
  const def = schema._def as {
    typeName?: string;
    innerType?: ZodTypeAny;
    type?: ZodTypeAny;
    values?: string[];
  };

  switch (def.typeName) {
    case 'ZodOptional':
    case 'ZodDefault':
      return `${describeType(def.innerType as ZodTypeAny)}?`;
    case 'ZodNullable':
      return `${describeType(def.innerType as ZodTypeAny)}|null`;
    case 'ZodArray':
      return `${describeType(def.type as ZodTypeAny)}[]`;
    case 'ZodEnum':
      return (def.values ?? []).join('|');
    case 'ZodString':
      return 'string';
    case 'ZodNumber':
      return 'number';
    case 'ZodBoolean':
      return 'boolean';
    case 'ZodObject':
      return 'object';
    default:
      return 'value';
  }
}

function asArgumentRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function sanitizeToolError(error: unknown): string {
  if (error instanceof AuthorizationError) {
    return 'You are not allowed to use this tool';
  }

  if (error instanceof ValidationError) {
    return 'Tool arguments failed schema validation';
  }

  if (error instanceof AppError) {
    return sanitizeErrorMessage(error.message);
  }

  return 'The tool failed';
}
