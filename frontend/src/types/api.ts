export type { ApiResponse, ErrorResponse, SuccessResponse } from '@hackathon/api-contract';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: string;
  role: string;
  roles: string[];
  permissions: string[];
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface AuthSessionPayload {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface HealthData {
  status: string;
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface DependencyCheck {
  configured: boolean;
  healthy: boolean;
  skipped: boolean;
  latencyMs?: number;
  error?: string;
}

export interface ReadinessData {
  status: 'ready' | 'not_ready';
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
    odoo: DependencyCheck;
    ai: DependencyCheck;
  };
}
