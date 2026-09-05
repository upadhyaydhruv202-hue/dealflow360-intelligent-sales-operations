import pino from 'pino';
import { describe, expect, it } from 'vitest';

import { AuditService, createMemoryAuditStore } from '../audit';
import { AUDIT_ACTIONS } from '../constants';
import { loadConfig } from '../config';
import { FeatureDisabledError } from '../errors';
import { analysisSimpleSearch, createCapabilityRecommendationService } from './index';

describe('CapabilityRecommendationService', () => {
  it('returns advisory recommendations and audits counts only', async () => {
    const audit = new AuditService(createMemoryAuditStore());
    const service = createCapabilityRecommendationService({
      config: loadConfig({
        NODE_ENV: 'test',
        FEATURE_CAPABILITY_RECOMMENDATIONS: 'true',
      }),
      logger: pino({ level: 'silent' }),
      audit,
    });

    const result = await service.recommend({
      analysis: analysisSimpleSearch(),
      title: 'Customers',
      userId: '11111111-1111-1111-1111-111111111111',
    });

    expect(result.advisory).toBe(true);
    expect(result.enabledNothing).toBe(true);
    expect(result.selected.infrastructure).toContain('infrastructure.postgres');

    const events = await audit.list({ action: AUDIT_ACTIONS.CAPABILITY_RECOMMENDATIONS_GENERATED });
    expect(events.items).toHaveLength(1);
    expect(JSON.stringify(events.items[0])).not.toContain('customer records by name');
  });

  it('throws when the feature is disabled', async () => {
    const service = createCapabilityRecommendationService({
      config: loadConfig({ NODE_ENV: 'test', FEATURE_CAPABILITY_RECOMMENDATIONS: 'false' }),
      logger: pino({ level: 'silent' }),
    });

    await expect(service.recommend({ analysis: analysisSimpleSearch() })).rejects.toBeInstanceOf(
      FeatureDisabledError,
    );
  });
});
