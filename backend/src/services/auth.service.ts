import { randomUUID } from 'node:crypto';

import type { PrismaClient } from '@prisma/client';

import type { TokenRevocationStore } from '../auth/token-revocation';
import { hashToken } from '../auth/token-hash';
import { assertAccountActive } from '../auth/account';
import type { TokenService } from '../auth/jwt';
import type { PasswordService } from '../auth/password';
import { toAuthenticatedUser, type AuthenticatedUser, type AuthSession } from '../auth/types';
import { AuthenticationError, AuthorizationError, ConflictError } from '../errors';
import { AUDIT_ACTIONS } from '../constants';
import type { AuditService } from '../audit/audit.service';
import { withTransaction } from '../lib/transaction';
import { createRepositories, type Repositories } from '../repositories';
import type { UserWithRoles } from '../repositories/types';

const INVALID_CREDENTIALS = 'Invalid email or password';

export interface AuthServiceDependencies {
  prisma: PrismaClient;
  passwordService: PasswordService;
  tokenService: TokenService;
  defaultRole: string;
  revocation?: TokenRevocationStore | null;
  onUserCreated?: (user: {
    id: string;
    email: string;
    displayName: string;
    companyName?: string;
  }) => void | Promise<void>;
  audit?: AuditService | null;
}

export class AuthService {
  constructor(private readonly deps: AuthServiceDependencies) {}

  async register(input: {
    email: string;
    password: string;
    displayName: string;
    companyName?: string;
  }): Promise<AuthSession> {
    const passwordHash = await this.deps.passwordService.hash(input.password);

    const session = await withTransaction(this.deps.prisma, async (tx) => {
      const repos = createRepositories(tx);
      let created;
      try {
        created = await repos.users.create({
          email: input.email,
          passwordHash,
          displayName: input.displayName,
        });
      } catch (error) {
        if (error instanceof ConflictError) {
          throw new ConflictError('An account with this email already exists');
        }
        throw error;
      }

      const role = await repos.roles.findByName(this.deps.defaultRole);
      if (role) {
        await repos.roles.assignUser(created.id, role.id);
      }

      const user = (await repos.users.findByIdWithRoles(created.id)) ?? {
        ...created,
        roles: [],
        permissions: [],
      };
      return (await this.issueSession(repos, user)).session;
    });

    try {
      await this.deps.onUserCreated?.({
        id: session.user.id,
        email: session.user.email,
        displayName: session.user.displayName,
        companyName: input.companyName,
      });
    } catch {
      // Event emission must not fail registration.
    }

    await this.deps.audit?.record({
      actorId: session.user.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      resource: 'user',
      resourceId: session.user.id,
      metadata: { email: session.user.email },
      status: 'succeeded',
    });

    return session;
  }

  async login(input: { email: string; password: string }): Promise<AuthSession> {
    const repos = createRepositories(this.deps.prisma);
    const record = await repos.users.findByEmailForAuth(input.email);

    if (!record) {
      await this.deps.passwordService.verifyUnknown(input.password);
      await this.deps.audit?.record({
        action: AUDIT_ACTIONS.USER_LOGIN,
        resource: 'user',
        status: 'failed',
      });
      throw new AuthenticationError(INVALID_CREDENTIALS);
    }

    const matches = await this.deps.passwordService.verify(input.password, record.passwordHash);
    if (!matches) {
      await this.deps.audit?.record({
        actorId: record.id,
        action: AUDIT_ACTIONS.USER_LOGIN,
        resource: 'user',
        resourceId: record.id,
        status: 'failed',
      });
      throw new AuthenticationError(INVALID_CREDENTIALS);
    }

    if (record.status !== 'active') {
      assertAccountActive(record.status);
    }

    const user = await repos.users.findByIdWithRoles(record.id);
    if (!user) {
      throw new AuthenticationError(INVALID_CREDENTIALS);
    }

    const session = (await this.issueSession(repos, user)).session;
    await this.deps.audit?.record({
      actorId: user.id,
      action: AUDIT_ACTIONS.USER_LOGIN,
      resource: 'user',
      resourceId: user.id,
      status: 'succeeded',
    });
    return session;
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const claims = this.deps.tokenService.verifyRefresh(refreshToken);
    const tokenHash = hashToken(refreshToken);

    const outcome = await withTransaction(this.deps.prisma, async (tx) => {
      const repos = createRepositories(tx);
      const stored = await repos.refreshTokens.findByTokenHash(tokenHash);

      if (!stored || stored.id !== claims.jti || stored.userId !== claims.sub) {
        return { kind: 'invalid' as const };
      }

      if (stored.revokedAt) {
        await repos.refreshTokens.revokeFamily(stored.familyId);
        return { kind: 'reuse' as const };
      }

      if (stored.expiresAt.getTime() <= Date.now()) {
        return { kind: 'expired' as const };
      }

      const user = await repos.users.findByIdWithRoles(stored.userId);
      if (!user || user.status !== 'active') {
        await repos.refreshTokens.revokeFamily(stored.familyId);
        return { kind: 'disabled' as const };
      }

      const issued = await this.issueSession(repos, user, stored.familyId);
      const claimed = await repos.refreshTokens.claimForRotation(stored.id, issued.refreshTokenId);
      if (!claimed) {
        await repos.refreshTokens.revoke(issued.refreshTokenId);
        return { kind: 'invalid' as const };
      }
      return { kind: 'session' as const, session: issued.session };
    });

    if (outcome.kind === 'session') {
      return outcome.session;
    }

    if (outcome.kind === 'reuse') {
      throw new AuthenticationError('Refresh token has been revoked');
    }

    if (outcome.kind === 'disabled') {
      throw new AuthorizationError('Account is disabled');
    }

    if (outcome.kind === 'expired') {
      throw new AuthenticationError('Token has expired');
    }

    throw new AuthenticationError('Invalid or malformed token');
  }

  async logout(refreshToken: string, accessToken?: string): Promise<{ revoked: true }> {
    const claims = this.deps.tokenService.verifyRefresh(refreshToken);
    const stored = await createRepositories(this.deps.prisma).refreshTokens.findByTokenHash(
      hashToken(refreshToken),
    );

    if (!stored || stored.id !== claims.jti || stored.userId !== claims.sub) {
      throw new AuthenticationError('Invalid or malformed token');
    }

    if (!stored.revokedAt) {
      await createRepositories(this.deps.prisma).refreshTokens.revokeFamily(stored.familyId);
    }

    await this.denyAccessToken(accessToken);
    return { revoked: true };
  }

  private async denyAccessToken(accessToken?: string): Promise<void> {
    if (!accessToken || !this.deps.revocation) {
      return;
    }

    try {
      const claims = this.deps.tokenService.verifyAccess(accessToken);
      await this.deps.revocation.denyAccessJti(claims.jti);
    } catch {
      // Refresh-family logout still succeeds when the access token is missing or expired.
    }
  }

  async getMe(userId: string): Promise<AuthenticatedUser> {
    const user = await createRepositories(this.deps.prisma).users.findByIdWithRoles(userId);
    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    if (user.status !== 'active') {
      throw new AuthorizationError('Account is disabled');
    }

    return toAuthenticatedUser(user);
  }

  async hasAccount(email: string): Promise<boolean> {
    const record = await createRepositories(this.deps.prisma).users.findByEmailForAuth(email);
    return Boolean(record);
  }

  assertPasswordPolicy(password: string): void {
    this.deps.passwordService.validate(password);
  }

  async resetPassword(email: string, password: string): Promise<{ reset: true }> {
    this.deps.passwordService.validate(password);
    const passwordHash = await this.deps.passwordService.hash(password);
    const repos = createRepositories(this.deps.prisma);
    const record = await repos.users.findByEmailForAuth(email);

    if (!record) {
      throw new AuthenticationError('Invalid or expired OTP');
    }

    if (record.status !== 'active') {
      assertAccountActive(record.status);
    }

    await repos.users.update(record.id, { passwordHash });
    await repos.refreshTokens.revokeAllForUser(record.id);
    await this.deps.revocation?.revokeUserAccess(record.id);
    await this.deps.audit?.record({
      actorId: record.id,
      action: AUDIT_ACTIONS.USER_PASSWORD_RESET,
      resource: 'user',
      resourceId: record.id,
      status: 'succeeded',
    });
    return { reset: true };
  }

  async createSessionForVerifiedEmail(email: string): Promise<AuthSession | null> {
    const repos = createRepositories(this.deps.prisma);
    const record = await repos.users.findByEmailForAuth(email);
    if (!record) {
      return null;
    }

    if (record.status !== 'active') {
      assertAccountActive(record.status);
    }

    const user = await repos.users.findByIdWithRoles(record.id);
    if (!user) {
      return null;
    }

    return (await this.issueSession(repos, user)).session;
  }

  private async issueSession(
    repos: Repositories,
    user: UserWithRoles,
    familyId?: string,
  ): Promise<{ session: AuthSession; refreshTokenId: ReturnType<typeof randomUUID> }> {
    const authUser = toAuthenticatedUser(user);
    const refreshId = randomUUID();
    const nextFamilyId = familyId ?? randomUUID();
    const tvn = (await this.deps.revocation?.currentAccessVersion(user.id)) ?? 0;
    const accessToken = this.deps.tokenService.signAccess({
      userId: user.id,
      role: authUser.role,
      tvn,
    });
    const refreshToken = this.deps.tokenService.signRefresh({
      userId: user.id,
      role: authUser.role,
      jti: refreshId,
    });

    await repos.refreshTokens.create({
      id: refreshId,
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      familyId: nextFamilyId,
      expiresAt: new Date(Date.now() + this.deps.tokenService.refreshExpiresInSeconds * 1000),
    });

    return {
      refreshTokenId: refreshId,
      session: {
        user: authUser,
        tokens: {
          accessToken,
          refreshToken,
          tokenType: 'Bearer',
          expiresIn: this.deps.tokenService.accessExpiresInSeconds,
        },
      },
    };
  }
}
