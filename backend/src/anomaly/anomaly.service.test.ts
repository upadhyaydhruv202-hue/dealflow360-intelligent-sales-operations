import { describe, expect, it } from 'vitest';

import { AuditService, createMemoryAuditStore } from '../audit';
import { loadConfig } from '../config';
import { ERROR_CODES } from '../constants';
import { createEventBus } from '../events';
import { FeatureDisabledError } from '../errors';
import { createTestService, silentLogger } from '../integrations/ai/ai.test-helpers';
import { ExternalServiceError } from '../errors';
import { createAnomalyService } from './anomaly.service';
import { HIGH_DROP_SALES, INSUFFICIENT_POINTS, LOW_DROP_SALES, STABLE_SALES } from './fixtures';
import { createMemoryAnomalyStore } from './stores/memory.store';

function build(env: Record<string, string> = {}, options: { failExplain?: boolean } = {}) {
  const config = loadConfig({
    NODE_ENV: 'test',
    FEATURE_ANOMALY_DETECTION: 'true',
    FEATURE_AI: 'true',
    AI_PROVIDER: 'mock',
    DEMO_MODE: 'true',
    ...env,
  });
  const { service: ai, provider } = createTestService(
    options.failExplain ? { runtime: { maxRetries: 0, parseRetries: 0 } } : {},
  );
  if (options.failExplain) {
    provider.enqueue(new ExternalServiceError('AI explanation failed', { provider: 'mock' }));
  }
  const events = createEventBus(silentLogger);
  const emitted: string[] = [];
  events.on('anomaly.detected', (event) => {
    emitted.push(event.type);
  });
  const anomaly = createAnomalyService({
    config,
    logger: silentLogger,
    ai,
    audit: new AuditService(createMemoryAuditStore()),
    events,
    store: createMemoryAnomalyStore(),
  });
  return { anomaly, emitted };
}

describe('AnomalyService', () => {
  it('returns no anomaly for a stable series without calling that a significance test', async () => {
    const { anomaly, emitted } = build();
    const result = await anomaly.evaluate({ metric: 'sales', points: STABLE_SALES, explain: false });
    expect(result.anomaly).toBe(false);
    expect(result.severity).toBe('NONE');
    expect(result.evidence.claimsStatisticalSignificance).toBe(false);
    expect(result.explanationStatus).toBe('skipped');
    expect(emitted).toEqual([]);
  });

  it('returns a low anomaly from percent change', async () => {
    const { anomaly } = build();
    const result = await anomaly.evaluate({
      metric: 'sales',
      points: LOW_DROP_SALES,
      explain: false,
      detectors: {
        zScore: { enabled: false },
        frequency: { enabled: false },
        movingAverage: { enabled: false },
        trend: { enabled: false },
      },
    });
    expect(result.anomaly).toBe(true);
    expect(result.severity).toBe('LOW');
    expect(result.evidence.fired).toContain('percentChange');
  });

  it('returns a high anomaly with measured change separate from AI explanation', async () => {
    const { anomaly, emitted } = build({ FEATURE_AUTOMATION: 'true' });
    const result = await anomaly.evaluate({ metric: 'sales', points: HIGH_DROP_SALES });
    expect(result.anomaly).toBe(true);
    expect(result.severity).toBe('HIGH');
    expect(result.change).toBe(-23.4);
    expect(result.evidence.claimsStatisticalSignificance).toBe(false);
    expect(result.explanation.length).toBeGreaterThan(8);
    expect(result.recommendedAction.length).toBeGreaterThan(8);
    expect(result.explanationStatus).toBe('generated');
    expect(emitted).toEqual(['anomaly.detected']);
  });

  it('does not claim a z-score anomaly when data is insufficient', async () => {
    const { anomaly } = build();
    const result = await anomaly.evaluate({
      metric: 'sales',
      points: INSUFFICIENT_POINTS,
      explain: false,
      detectors: {
        threshold: { enabled: false },
        percentChange: { enabled: false },
        movingAverage: { enabled: false },
        frequency: { enabled: false },
        trend: { enabled: false },
        zScore: { enabled: true },
      },
    });
    expect(result.anomaly).toBe(false);
    expect(result.evidence.insufficientData).toBe(true);
    expect(result.explanationStatus).toBe('skipped');
    expect(result.explanation).toMatch(/not enough observations/i);
  });

  it('keeps statistical evidence when AI explanation fails', async () => {
    const { anomaly } = build({ FEATURE_AUTOMATION: 'true' }, { failExplain: true });
    const result = await anomaly.evaluate({ metric: 'sales', points: HIGH_DROP_SALES });
    expect(result.anomaly).toBe(true);
    expect(result.severity).toBe('HIGH');
    expect(result.change).toBe(-23.4);
    expect(result.explanationStatus).toBe('failed');
    expect(result.recommendedAction).toMatch(/AI explanation is unavailable/i);
  });

  it('stays disabled unless FEATURE_ANOMALY_DETECTION is on', async () => {
    const { anomaly } = build({ FEATURE_ANOMALY_DETECTION: 'false' });
    await expect(anomaly.evaluate({ metric: 'sales', points: STABLE_SALES })).rejects.toMatchObject({
      code: ERROR_CODES.FEATURE_DISABLED,
    });
    await expect(anomaly.evaluate({ metric: 'sales', points: STABLE_SALES })).rejects.toBeInstanceOf(
      FeatureDisabledError,
    );
  });

  it('detects without an AI provider and does not invent an explanation', async () => {
    const config = loadConfig({
      NODE_ENV: 'test',
      FEATURE_ANOMALY_DETECTION: 'true',
      FEATURE_AI: 'false',
    });
    const anomaly = createAnomalyService({
      config,
      logger: silentLogger,
      store: createMemoryAnomalyStore(),
    });
    const result = await anomaly.evaluate({ metric: 'sales', points: HIGH_DROP_SALES, explain: true });
    expect(result.anomaly).toBe(true);
    expect(result.change).toBe(-23.4);
    expect(result.explanationStatus).toBe('unavailable');
    expect(result.evidence.claimsStatisticalSignificance).toBe(false);
  });

  it('rejects a series longer than ANOMALY_MAX_POINTS', async () => {
    const { anomaly } = build({ ANOMALY_MAX_POINTS: '3' });
    await expect(anomaly.evaluate({ metric: 'sales', points: [100, 101, 99, 70] })).rejects.toMatchObject({
      code: ERROR_CODES.VALIDATION_ERROR,
    });
  });
});
