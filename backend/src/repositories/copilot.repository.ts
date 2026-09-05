import type { Prisma } from '@prisma/client';

import { NotFoundError } from '../errors';
import { mapPrismaError } from '../lib/prisma-error';
import { parsePagination, toPaginatedResult } from './query';
import type { DbClient } from './types';
import { parseStoredToolCalls } from '../copilot/copilot.memory';
import { redactText } from '../copilot/copilot.redact';
import type {
  CopilotConversationRecord,
  CopilotConversationStore,
  CopilotMessageRecord,
} from '../copilot/copilot.types';

export class CopilotRepository implements CopilotConversationStore {
  constructor(private readonly db: DbClient) {}

  async create(userId: string): Promise<CopilotConversationRecord> {
    try {
      return await this.db.copilotConversation.create({
        data: { userId },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async getForUser(id: string, userId: string): Promise<CopilotConversationRecord> {
    try {
      const conversation = await this.db.copilotConversation.findFirst({ where: { id, userId } });
      if (!conversation) {
        throw new NotFoundError('Conversation not found');
      }
      return conversation;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listForUser(userId: string, query?: { page?: number; pageSize?: number }) {
    const pagination = parsePagination(query ?? {});
    try {
      const where = { userId };
      const [items, totalItems] = await Promise.all([
        this.db.copilotConversation.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: pagination.skip,
          take: pagination.take,
        }),
        this.db.copilotConversation.count({ where }),
      ]);
      return toPaginatedResult(items, pagination, totalItems);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async deleteForUser(id: string, userId: string): Promise<void> {
    await this.getForUser(id, userId);
    try {
      await this.db.copilotConversation.delete({ where: { id } });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async addMessage(input: Parameters<CopilotConversationStore['addMessage']>[0]): Promise<CopilotMessageRecord> {
    try {
      const created = await this.db.copilotMessage.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: redactText(input.content),
          toolCalls: (input.toolCalls ?? undefined) as Prisma.InputJsonValue | undefined,
          confidence: input.confidence ?? null,
          evidence: input.evidence ?? null,
          errorCode: input.errorCode ?? null,
        },
      });
      await this.db.copilotConversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });
      return toMessage(created);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async listMessages(conversationId: string, limit?: number): Promise<CopilotMessageRecord[]> {
    try {
      const messages = await this.db.copilotMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        ...(limit ? { take: limit } : {}),
      });
      return messages.reverse().map(toMessage);
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async clearMessages(conversationId: string, userId: string): Promise<void> {
    await this.getForUser(conversationId, userId);
    try {
      await this.db.copilotMessage.deleteMany({ where: { conversationId } });
      await this.db.copilotConversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }
}

function toMessage(row: {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: unknown;
  confidence: number | null;
  evidence: string | null;
  errorCode: string | null;
  createdAt: Date;
}): CopilotMessageRecord {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role,
    content: row.content,
    toolCalls: parseStoredToolCalls(row.toolCalls),
    confidence: row.confidence,
    evidence: row.evidence,
    errorCode: row.errorCode,
    createdAt: row.createdAt,
  };
}
