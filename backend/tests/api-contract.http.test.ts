import {
  API_PATHS,
  API_PREFIX,
  OPERATIONAL_PATHS,
  errorResponseSchema,
  publicFeatureStateSchema,
  unknownSuccessResponseSchema,
} from '@hackathon/api-contract';
import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';

const logger = pino({ level: 'silent' });

function buildApp() {
  return createApp({
    config: loadConfig({
      NODE_ENV: 'test',
      APP_NAME: 'Hackathon Starter Kit',
      DEMO_MODE: 'true',
      FEATURE_AI: 'true',
      AI_PROVIDER: 'mock',
    }),
    logger,
  }).app;
}

describe('shared API contract over HTTP', () => {
  it('returns contract-valid envelopes for /api/v1 and /api/v1/features', async () => {
    const app = buildApp();

    const info = await request(app).get(API_PATHS.root);
    expect(info.status).toBe(200);
    expect(unknownSuccessResponseSchema.parse(info.body)).toMatchObject({
      success: true,
      data: { version: 'v1', status: 'ok' },
    });
    expect(API_PATHS.root).toBe(API_PREFIX);

    const features = await request(app).get(API_PATHS.features);
    expect(features.status).toBe(200);
    const envelope = unknownSuccessResponseSchema.parse(features.body);
    expect(publicFeatureStateSchema.parse(envelope.data)).toMatchObject({
      demoMode: true,
      features: expect.objectContaining({ ai: true }),
    });
  });

  it('returns a contract-valid error envelope for unknown routes', async () => {
    const response = await request(buildApp()).get(`${API_PREFIX}/missing-contract-route`);
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body)).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('keeps operational probes outside /api/v1 and still uses the success envelope', async () => {
    const health = await request(buildApp()).get(OPERATIONAL_PATHS.health);
    expect(OPERATIONAL_PATHS.health.startsWith(API_PREFIX)).toBe(false);
    expect(unknownSuccessResponseSchema.parse(health.body).success).toBe(true);
  });
});
