import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { AuditService, createMemoryAuditStore } from '../audit';
import { AUDIT_ACTIONS } from '../constants';
import { loadConfig } from '../config';
import { FeatureDisabledError, ValidationError } from '../errors';
import { createProjectPlanningService } from './index';

describe('ProjectPlanningService', () => {
  it('analyzes a statement, validates a selection, and audits without storing the statement', async () => {
    const audit = new AuditService(createMemoryAuditStore());
    const service = createProjectPlanningService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_PLANNING: 'true' }),
      logger: pino({ level: 'silent' }),
      audit,
    });

    const analyzed = await service.analyze({
      statement: 'Staff look up customer records by name in a logged-in web app.',
      title: 'Customers',
      userId: '11111111-1111-1111-1111-111111111111',
    });

    expect(analyzed.configuration.generatedNothing).toBe(true);
    expect(analyzed.configuration.approved).toBe(false);
    expect(analyzed.recommendations.advisory).toBe(true);
    expect(analyzed.configuration.resolved.infrastructure).toContain('infrastructure.postgres');

    const validated = await service.validate({
      capabilities: ['auth', 'database', 'infrastructure.postgres'],
      userId: '11111111-1111-1111-1111-111111111111',
    });
    expect(validated.validation.valid).toBe(true);
    expect(validated.approved).toBe(false);

    const approved = await service.approve({
      capabilities: ['auth', 'database', 'infrastructure.postgres'],
      userId: '11111111-1111-1111-1111-111111111111',
    });
    expect(approved.approved).toBe(true);
    expect(approved.status).toBe('approved');

    const analyzedEvents = await audit.list({ action: AUDIT_ACTIONS.PROJECT_PLANNING_ANALYZED });
    expect(analyzedEvents.items).toHaveLength(1);
    expect(JSON.stringify(analyzedEvents.items[0])).not.toContain('customer records by name');

    const approvedEvents = await audit.list({ action: AUDIT_ACTIONS.PROJECT_PLANNING_APPROVED });
    expect(approvedEvents.items).toHaveLength(1);
    expect(JSON.stringify(approvedEvents.items[0])).not.toContain('customer records by name');
  });

  it('throws when the feature is disabled', async () => {
    const service = createProjectPlanningService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_PLANNING: 'false' }),
      logger: pino({ level: 'silent' }),
    });

    await expect(service.analyze({ statement: 'Staff log in.' })).rejects.toBeInstanceOf(FeatureDisabledError);
  });

  it('refuses to approve an invalid selection', async () => {
    const service = createProjectPlanningService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_PROJECT_PLANNING: 'true' }),
      logger: pino({ level: 'silent' }),
    });

    await expect(service.approve({ capabilities: ['copilot'] })).rejects.toBeInstanceOf(ValidationError);
  });
});
