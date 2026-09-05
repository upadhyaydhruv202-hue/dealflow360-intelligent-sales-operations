import type { z } from 'zod';

import type { AuthenticatedUser } from '../../../auth/types';

export const AI_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type AiRiskLevel = (typeof AI_RISK_LEVELS)[number];

export const AI_ACTION_KINDS = [
  'read',
  'write',
  'deletion',
  'bulk_change',
  'financial',
  'external_message',
  'privileged_odoo',
] as const;
export type AiActionKind = (typeof AI_ACTION_KINDS)[number];

export const HIGH_RISK_ACTION_KINDS = [
  'deletion',
  'bulk_change',
  'financial',
  'external_message',
  'privileged_odoo',
] as const;
export type HighRiskActionKind = (typeof HIGH_RISK_ACTION_KINDS)[number];

export const AI_TOOL_STATUSES = [
  'success',
  'failed',
  'denied',
  'invalid_arguments',
  'pending_confirmation',
] as const;
export type AiToolStatus = (typeof AI_TOOL_STATUSES)[number];

export const UNTRUSTED_DATA_KINDS = ['user', 'document', 'tool'] as const;
export type UntrustedDataKind = (typeof UNTRUSTED_DATA_KINDS)[number];

export interface InjectionAssessment {
  suspicious: boolean;
  signals: string[];
}

export interface AiToolContext {
  user: AuthenticatedUser;
  requestId?: string;
  confirmed: boolean;
  conversationId?: string;
}

export interface AiToolDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  requiredPermission: string;
  riskLevel: AiRiskLevel;
  actionKind?: AiActionKind;
  needsConfirmation?: (input: TInput) => boolean;
  handler: (input: TInput, context: AiToolContext) => Promise<TOutput> | TOutput;
}

export function defineAiTool<TInput, TOutput = unknown>(
  tool: AiToolDefinition<TInput, TOutput>,
): AiToolDefinition<TInput, TOutput> {
  return tool;
}

/** Heterogeneous registry entry. Each tool is still validated with its own Zod schema at execution. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixed tool input types are erased at the registry boundary
export type RegisteredAiTool = AiToolDefinition<any, any>;

export interface AiToolDescriptor {
  name: string;
  description: string;
  arguments: Record<string, string>;
  requiredPermission: string;
  riskLevel: AiRiskLevel;
  actionKind?: AiActionKind;
  requiresConfirmation: boolean;
}

export interface AiToolExecution {
  name: string;
  arguments: Record<string, unknown>;
  status: AiToolStatus;
  riskLevel: AiRiskLevel;
  actionKind?: AiActionKind;
  result?: unknown;
  error?: string;
}

export interface AiToolResolver {
  get(name: string): RegisteredAiTool | undefined;
}

export interface AiDecision<T = Record<string, unknown>> {
  result: T;
  confidence: number;
  evidence: string[];
  requiresReview: boolean;
}

export interface AiGuardrailsLimits {
  maxInputChars: number;
  timeoutMs: number;
  maxRetries: number;
  parseRetries: number;
}
