import type { Prisma, RefreshToken } from '@prisma/client';

import { mapPrismaError } from '../lib/prisma-error';
import type { DbClient } from './types';

export interface CreateRefreshTokenInput {
  id: string;
  userId: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

export class RefreshTokenRepository {
  constructor(private readonly db: DbClient) {}

  async create(input: CreateRefreshTokenInput): Promise<RefreshToken> {
    try {
      return await this.db.refreshToken.create({
        data: {
          id: input.id,
          userId: input.userId,
          tokenHash: input.tokenHash,
          familyId: input.familyId,
          expiresAt: input.expiresAt,
        },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    try {
      return await this.db.refreshToken.findUnique({
        where: { tokenHash },
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async claimForRotation(id: string, replacedBy: string): Promise<boolean> {
    try {
      const result = await this.db.refreshToken.updateMany({
        where: { id, revokedAt: null },
        data: {
          revokedAt: new Date(),
          replacedBy,
        },
      });
      return result.count === 1;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async revoke(id: string, replacedBy?: string): Promise<void> {
    try {
      await this.db.refreshToken.update({
        where: { id },
        data: {
          revokedAt: new Date(),
          replacedBy: replacedBy ?? null,
        } as Prisma.RefreshTokenUpdateInput,
      });
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async revokeFamily(familyId: string): Promise<number> {
    try {
      const result = await this.db.refreshToken.updateMany({
        where: { familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    } catch (error) {
      mapPrismaError(error);
    }
  }

  async revokeAllForUser(userId: string): Promise<number> {
    try {
      const result = await this.db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return result.count;
    } catch (error) {
      mapPrismaError(error);
    }
  }
}
