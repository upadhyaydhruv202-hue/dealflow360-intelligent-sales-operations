import { describe, expect, it } from 'vitest';

import { HealthService } from './health.service';

describe('HealthService', () => {
  const baseOptions = {
    serviceName: 'kit',
    environment: 'test',
  };

  it('returns application status without checking dependencies', () => {
    const service = new HealthService(baseOptions);
    const health = service.getHealth();

    expect(health.status).toBe('ok');
    expect(health.service).toBe('kit');
    expect(health.environment).toBe('test');
    expect(health.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(health.timestamp).toEqual(expect.any(String));
  });

  it('treats unconfigured dependencies as skipped and ready', async () => {
    const service = new HealthService(baseOptions);
    const readiness = await service.getReadiness();

    expect(readiness.status).toBe('ready');
    expect(readiness.checks.database).toMatchObject({
      configured: false,
      healthy: true,
      skipped: true,
    });
    expect(readiness.checks.redis).toMatchObject({
      configured: false,
      healthy: true,
      skipped: true,
    });
    expect(readiness.checks.odoo).toMatchObject({
      configured: false,
      healthy: true,
      skipped: true,
    });
    expect(readiness.checks.ai).toMatchObject({
      configured: false,
      healthy: true,
      skipped: true,
    });
  });

  it('reports ready when configured dependencies ping successfully', async () => {
    const service = new HealthService({
      ...baseOptions,
      database: { ping: async () => undefined },
      redis: { ping: async () => undefined },
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('ready');
    expect(readiness.checks.database.configured).toBe(true);
    expect(readiness.checks.database.healthy).toBe(true);
    expect(readiness.checks.redis.healthy).toBe(true);
    expect(readiness.checks.odoo.skipped).toBe(true);
    expect(readiness.checks.ai.skipped).toBe(true);
  });

  it('reports not ready when a configured dependency fails', async () => {
    const service = new HealthService({
      ...baseOptions,
      database: {
        ping: async () => {
          throw new Error('connection refused');
        },
      },
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.database.healthy).toBe(false);
    expect(readiness.checks.database.error).toBe('connection refused');
  });

  it('sanitizes secrets in dependency error messages', async () => {
    const service = new HealthService({
      ...baseOptions,
      database: {
        ping: async () => {
          throw new Error('password=super-secret api_key=abcd');
        },
      },
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.database.error).not.toMatch(/super-secret|abcd/);
    expect(readiness.checks.database.error).toMatch(/\[Redacted\]/);
  });

  it('reports not ready when configured Odoo is unhealthy', async () => {
    const service = new HealthService({
      ...baseOptions,
      odoo: {
        ping: async () => {
          throw new Error('Invalid apikey');
        },
      },
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.odoo.healthy).toBe(false);
    expect(readiness.checks.odoo.error).toBe('Invalid apikey');
  });

  it('reports not ready when configured AI is unhealthy', async () => {
    const service = new HealthService({
      ...baseOptions,
      ai: {
        ping: async () => {
          throw new Error('AI provider authentication failed');
        },
      },
    });

    const readiness = await service.getReadiness();
    expect(readiness.status).toBe('not_ready');
    expect(readiness.checks.ai.healthy).toBe(false);
    expect(readiness.checks.ai.error).toBe('AI provider authentication failed');
  });
});
