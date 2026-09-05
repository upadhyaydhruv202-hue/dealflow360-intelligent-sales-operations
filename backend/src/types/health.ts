export interface DependencyCheck {
  configured: boolean;
  healthy: boolean;
  skipped: boolean;
  latencyMs?: number;
  error?: string;
}

export interface HealthStatus {
  status: 'ok';
  service: string;
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessStatus {
  status: 'ready' | 'not_ready';
  checks: {
    database: DependencyCheck;
    redis: DependencyCheck;
    odoo: DependencyCheck;
    ai: DependencyCheck;
  };
}
