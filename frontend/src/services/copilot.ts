import { API_PATHS } from '@hackathon/api-contract';

import { apiRequest } from './api';

export type CopilotToolStatus =
  | 'success'
  | 'failed'
  | 'denied'
  | 'invalid_arguments'
  | 'pending_confirmation';

export interface CopilotToolExecution {
  name: string;
  arguments: Record<string, unknown>;
  status: CopilotToolStatus;
  riskLevel: 'low' | 'medium' | 'high';
  result?: unknown;
  error?: string;
}

export interface CopilotChatResult {
  conversationId: string;
  status: 'completed' | 'pending_confirmation' | 'error';
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

export function sendCopilotMessage(
  input: { message?: string; conversationId?: string; confirm?: boolean },
  token: string,
): Promise<CopilotChatResult> {
  return apiRequest<CopilotChatResult>(API_PATHS.copilot.chat, {
    method: 'POST',
    token,
    body: input,
  });
}

export function clearCopilotConversation(id: string, token: string): Promise<{ id: string; cleared: boolean }> {
  return apiRequest(API_PATHS.copilot.clearConversation(id), {
    method: 'POST',
    token,
  });
}
