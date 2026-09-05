import type { z } from 'zod';

import type { AuthenticatedUser } from '../auth/types';
import type { AiActionKind, AiRiskLevel } from '../integrations/ai/guardrails';

export const INTENT_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type IntentRiskLevel = AiRiskLevel;

export const INTENT_STATUSES = [
  'completed',
  'pending_confirmation',
  'denied',
  'invalid',
  'ambiguous',
  'error',
] as const;
export type IntentStatus = (typeof INTENT_STATUSES)[number];

/** High-risk classes from the product spec. Each maps onto an AI action kind that always needs confirmation. */
export const INTENT_HIGH_RISK_CLASSES = [
  'DELETE',
  'BULK_UPDATE',
  'SEND_EXTERNAL_MESSAGE',
  'FINANCIAL_ACTION',
] as const;
export type IntentHighRiskClass = (typeof INTENT_HIGH_RISK_CLASSES)[number];

export const INTENT_HIGH_RISK_ACTION_KIND: Record<IntentHighRiskClass, AiActionKind> = {
  DELETE: 'deletion',
  BULK_UPDATE: 'bulk_change',
  SEND_EXTERNAL_MESSAGE: 'external_message',
  FINANCIAL_ACTION: 'financial',
};

export interface IntentContext {
  user: AuthenticatedUser;
  requestId?: string;
  confirmed: boolean;
  utterance: string;
}

export interface IntentDefinition<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<TInput>;
  outputSchema?: z.ZodType<TOutput>;
  requiredPermission: string;
  riskLevel: IntentRiskLevel;
  actionKind?: AiActionKind;
  /** Product-level high-risk class. Always requires confirmation. */
  highRiskClass?: IntentHighRiskClass;
  examples?: string[];
  needsConfirmation?: (input: TInput) => boolean;
  /** Extra business rules after Zod parse. Throw ValidationError to reject. */
  validate?: (input: TInput, context: IntentContext) => void | Promise<void>;
  handler: (input: TInput, context: IntentContext) => Promise<TOutput> | TOutput;
}

export function defineIntent<TInput, TOutput = unknown>(
  intent: IntentDefinition<TInput, TOutput>,
): IntentDefinition<TInput, TOutput> {
  return intent;
}

/** Heterogeneous registry entry. Each intent is still validated with its own Zod schema at execution. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixed intent input types are erased at the registry boundary
export type RegisteredIntent = IntentDefinition<any, any>;

export interface IntentDescriptor {
  name: string;
  description: string;
  arguments: Record<string, string>;
  requiredPermission: string;
  riskLevel: IntentRiskLevel;
  actionKind?: AiActionKind;
  highRiskClass?: IntentHighRiskClass;
  requiresConfirmation: boolean;
  examples: string[];
}

export interface ExtractedIntentCommand {
  intent: string;
  input: Record<string, unknown>;
  confidence: number;
  evidence?: string;
  ambiguous: boolean;
  candidates: string[];
  clarification?: string;
}

export interface IntentExecuteInput {
  user: AuthenticatedUser;
  utterance?: string;
  confirm?: boolean;
  confirmationToken?: string;
}

export interface IntentExecuteResult {
  status: IntentStatus;
  utterance?: string;
  command?: {
    intent: string;
    input: Record<string, unknown>;
  };
  confidence?: number;
  evidence?: string;
  clarification?: string;
  candidates?: string[];
  riskLevel?: IntentRiskLevel;
  actionKind?: AiActionKind;
  highRiskClass?: IntentHighRiskClass;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  authorized?: boolean;
  result?: unknown;
  error?: string;
}

export interface PendingIntentCommand {
  token: string;
  userId: string;
  utterance: string;
  intent: string;
  input: Record<string, unknown>;
  confidence: number;
  evidence?: string;
  expiresAt: number;
}

export interface IntentConfirmationStore {
  save(command: Omit<PendingIntentCommand, 'token' | 'expiresAt'>): Promise<PendingIntentCommand>;
  take(token: string, userId: string): Promise<PendingIntentCommand | undefined>;
}
