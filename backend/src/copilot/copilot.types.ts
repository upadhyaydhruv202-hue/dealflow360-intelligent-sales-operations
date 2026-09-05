import type { AuthenticatedUser } from '../auth/types';
import type { AiActionKind, AiRiskLevel, AiToolContext, AiToolDefinition } from '../integrations/ai/guardrails';
import type { PaginatedResult } from '../repositories/query';

export const COPILOT_RISK_LEVELS = ['low', 'medium', 'high'] as const;
export type CopilotRiskLevel = AiRiskLevel;

export const COPILOT_TOOL_STATUSES = [
  'success',
  'failed',
  'denied',
  'invalid_arguments',
  'pending_confirmation',
] as const;
export type CopilotToolStatus = (typeof COPILOT_TOOL_STATUSES)[number];

export const COPILOT_TURN_STATUSES = ['completed', 'pending_confirmation', 'error'] as const;
export type CopilotTurnStatus = (typeof COPILOT_TURN_STATUSES)[number];

export const COPILOT_MESSAGE_ROLES = ['user', 'assistant'] as const;
export type CopilotMessageRole = (typeof COPILOT_MESSAGE_ROLES)[number];

export type CopilotToolContext = AiToolContext & { conversationId: string };

export type CopilotToolDefinition<TInput = unknown, TOutput = unknown> = AiToolDefinition<TInput, TOutput>;

export function defineCopilotTool<TInput, TOutput = unknown>(
  tool: CopilotToolDefinition<TInput, TOutput>,
): CopilotToolDefinition<TInput, TOutput> {
  return tool;
}

/** Heterogeneous registry entry. Each tool is still validated with its own Zod schema at execution. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mixed tool input types are erased at the registry boundary
export type RegisteredCopilotTool = CopilotToolDefinition<any, any>;

export interface CopilotToolDescriptor {
  name: string;
  description: string;
  arguments: Record<string, string>;
  requiredPermission: string;
  riskLevel: CopilotRiskLevel;
  actionKind?: AiActionKind;
  requiresConfirmation: boolean;
}

export interface CopilotPlannedTool {
  name: string;
  arguments: Record<string, unknown>;
}

export interface CopilotPlan {
  intent: 'answer' | 'tool' | 'clarify';
  reply: string;
  tools: CopilotPlannedTool[];
  confidence: number;
  evidence?: string;
}

export interface CopilotToolExecution {
  name: string;
  arguments: Record<string, unknown>;
  status: CopilotToolStatus;
  riskLevel: CopilotRiskLevel;
  actionKind?: AiActionKind;
  result?: unknown;
  error?: string;
}

export interface CopilotConversationRecord {
  id: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CopilotMessageRecord {
  id: string;
  conversationId: string;
  role: CopilotMessageRole;
  content: string;
  toolCalls: CopilotToolExecution[] | null;
  confidence: number | null;
  evidence: string | null;
  errorCode: string | null;
  createdAt: Date;
}

export interface CopilotConversationStore {
  create(userId: string): Promise<CopilotConversationRecord>;
  getForUser(id: string, userId: string): Promise<CopilotConversationRecord>;
  listForUser(
    userId: string,
    query?: { page?: number; pageSize?: number },
  ): Promise<PaginatedResult<CopilotConversationRecord>>;
  deleteForUser(id: string, userId: string): Promise<void>;
  addMessage(input: {
    conversationId: string;
    role: CopilotMessageRole;
    content: string;
    toolCalls?: CopilotToolExecution[] | null;
    confidence?: number | null;
    evidence?: string | null;
    errorCode?: string | null;
  }): Promise<CopilotMessageRecord>;
  listMessages(conversationId: string, limit?: number): Promise<CopilotMessageRecord[]>;
  clearMessages(conversationId: string, userId: string): Promise<void>;
}

export interface CopilotChatResult {
  conversationId: string;
  status: CopilotTurnStatus;
  message: {
    id: string;
    role: 'assistant';
    content: string;
    confidence?: number;
    evidence?: string;
    errorCode?: string;
  };
  tools: CopilotToolExecution[];
}

export interface CopilotChatInput {
  user: AuthenticatedUser;
  message?: string;
  conversationId?: string;
  confirm?: boolean;
}
