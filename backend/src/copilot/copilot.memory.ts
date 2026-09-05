import { randomUUID } from 'node:crypto';

import { NotFoundError } from '../errors';
import { parsePagination, toPaginatedResult } from '../repositories/query';
import { redactText } from './copilot.redact';
import { copilotStoredToolCallsSchema } from './copilot.schemas';
import type {
  CopilotConversationRecord,
  CopilotConversationStore,
  CopilotMessageRecord,
  CopilotToolExecution,
} from './copilot.types';

interface MemoryConversation extends CopilotConversationRecord {
  messages: CopilotMessageRecord[];
}

export function createMemoryCopilotConversations(): CopilotConversationStore & {
  inspect(): MemoryConversation[];
} {
  const conversations = new Map<string, MemoryConversation>();

  return {
    async create(userId: string) {
      const now = new Date();
      const record: MemoryConversation = {
        id: randomUUID(),
        userId,
        createdAt: now,
        updatedAt: now,
        messages: [],
      };
      conversations.set(record.id, record);
      return publicConversation(record);
    },

    async getForUser(id: string, userId: string) {
      const record = conversations.get(id);
      if (!record || record.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }
      return publicConversation(record);
    },

    async listForUser(userId: string, query) {
      const items = [...conversations.values()]
        .filter((item) => item.userId === userId)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime());
      const pagination = parsePagination(query ?? {});
      return toPaginatedResult(
        items.slice(pagination.skip, pagination.skip + pagination.take).map(publicConversation),
        pagination,
        items.length,
      );
    },

    async deleteForUser(id: string, userId: string) {
      const record = conversations.get(id);
      if (!record || record.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }
      conversations.delete(id);
    },

    async addMessage(input) {
      const conversation = conversations.get(input.conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const message: CopilotMessageRecord = {
        id: randomUUID(),
        conversationId: input.conversationId,
        role: input.role,
        content: redactText(input.content),
        toolCalls: input.toolCalls ?? null,
        confidence: input.confidence ?? null,
        evidence: input.evidence ?? null,
        errorCode: input.errorCode ?? null,
        createdAt: new Date(),
      };
      conversation.messages.push(message);
      conversation.updatedAt = message.createdAt;
      return message;
    },

    async listMessages(conversationId: string, limit?: number) {
      const conversation = conversations.get(conversationId);
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }

      const messages = conversation.messages;
      if (!limit || messages.length <= limit) {
        return [...messages];
      }

      return messages.slice(messages.length - limit);
    },

    async clearMessages(conversationId: string, userId: string) {
      const conversation = conversations.get(conversationId);
      if (!conversation || conversation.userId !== userId) {
        throw new NotFoundError('Conversation not found');
      }
      conversation.messages = [];
      conversation.updatedAt = new Date();
    },

    inspect() {
      return [...conversations.values()];
    },
  };
}

export function parseStoredToolCalls(value: unknown): CopilotToolExecution[] | null {
  if (value == null) {
    return null;
  }

  const parsed = copilotStoredToolCallsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function publicConversation(record: MemoryConversation): CopilotConversationRecord {
  return {
    id: record.id,
    userId: record.userId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
