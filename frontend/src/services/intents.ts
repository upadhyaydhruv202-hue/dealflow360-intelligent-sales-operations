import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export type IntentStatus =
  | 'completed'
  | 'pending_confirmation'
  | 'denied'
  | 'invalid'
  | 'ambiguous'
  | 'error';

export interface IntentDescriptor {
  name: string;
  description: string;
  arguments: Record<string, string>;
  requiredPermission: string;
  riskLevel: 'low' | 'medium' | 'high';
  actionKind?: string;
  highRiskClass?: string;
  requiresConfirmation: boolean;
  examples: string[];
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
  riskLevel?: 'low' | 'medium' | 'high';
  highRiskClass?: string;
  requiresConfirmation?: boolean;
  confirmationToken?: string;
  authorized?: boolean;
  result?: unknown;
  error?: string;
}

export function listIntents(token: string): Promise<{ intents: IntentDescriptor[] }> {
  return apiRequest<{ intents: IntentDescriptor[] }>(API_PATHS.intents.root, { token });
}

export function executeIntent(
  input: { utterance?: string; confirm?: boolean; confirmationToken?: string },
  token: string,
): Promise<IntentExecuteResult> {
  return apiRequest<IntentExecuteResult>(API_PATHS.intents.execute, {
    method: 'POST',
    token,
    body: input,
  });
}
