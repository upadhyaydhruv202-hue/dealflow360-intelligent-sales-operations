export type UserStatus = 'active' | 'invited' | 'disabled';

export type TokenType = 'access' | 'refresh';

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  role: string;
  roles: string[];
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

export interface AccessTokenClaims {
  sub: string;
  type: 'access';
  role: string;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  tvn: number;
}

export interface RefreshTokenClaims {
  sub: string;
  type: 'refresh';
  role: string;
  jti: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

export type AuthTokenClaims = AccessTokenClaims | RefreshTokenClaims;

export interface AuthSession {
  user: AuthenticatedUser;
  tokens: TokenPair;
}

export const ROLE_PRECEDENCE: Record<string, number> = {
  admin: 0,
  manager: 1,
  staff: 2,
  user: 3,
};

export const DEFAULT_ROLE_NAME = 'user';

export function primaryRole(roles: readonly string[]): string {
  if (roles.length === 0) {
    return DEFAULT_ROLE_NAME;
  }

  return [...roles].sort((left, right) => {
    const leftRank = ROLE_PRECEDENCE[left] ?? 50;
    const rightRank = ROLE_PRECEDENCE[right] ?? 50;
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }
    return left.localeCompare(right);
  })[0];
}

export function toAuthenticatedUser(input: {
  id: string;
  email: string;
  displayName: string;
  status: UserStatus;
  roles: string[];
  permissions?: string[];
}): AuthenticatedUser {
  return {
    id: input.id,
    email: input.email,
    displayName: input.displayName,
    status: input.status,
    roles: input.roles,
    permissions: input.permissions ?? [],
    role: primaryRole(input.roles),
  };
}
