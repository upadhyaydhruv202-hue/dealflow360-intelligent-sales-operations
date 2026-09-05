import { sanitizeErrorMessage } from '../errors/sanitize';
import type { DependencyCheck, HealthStatus, ReadinessStatus } from '../types/health';
import type { Pingable } from '../types/lifecycle';

export interface HealthServiceOptions {
  serviceName: string;
  environment: string;
  database?: Pingable | null;
  redis?: Pingable | null;
  odoo?: Pingable | null;
  ai?: Pingable | null;
}

export class HealthService {
  constructor(private readonly options: HealthServiceOptions) {}

  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: this.options.serviceName,
      environment: this.options.environment,
      uptimeSeconds: Number(process.uptime().toFixed(3)),
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness(): Promise<ReadinessStatus> {
    const [database, redis, odoo, ai] = await Promise.all([
      this.checkDependency(this.options.database),
      this.checkDependency(this.options.redis),
      this.checkDependency(this.options.odoo),
      this.checkDependency(this.options.ai),
    ]);

    const ready = database.healthy && redis.healthy && odoo.healthy && ai.healthy;

    return {
      status: ready ? 'ready' : 'not_ready',
      checks: { database, redis, odoo, ai },
    };
  }

  private async checkDependency(client: Pingable | null | undefined): Promise<DependencyCheck> {
    if (!client) {
      return {
        configured: false,
        healthy: true,
        skipped: true,
      };
    }

    const started = Date.now();

    try {
      await client.ping();
      return {
        configured: true,
        healthy: true,
        skipped: false,
        latencyMs: Date.now() - started,
      };
    } catch (error) {
      return {
        configured: true,
        healthy: false,
        skipped: false,
        latencyMs: Date.now() - started,
        error: sanitizeErrorMessage(
          error instanceof Error ? error.message : 'Dependency check failed',
        ),
      };
    }
  }
}
