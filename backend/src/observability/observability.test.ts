import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';

import { MemoryErrorTracker } from './errors';
import { MemoryMetrics } from './metrics';
import { recordAiCall, recordJobMetric, recordNotificationDelivery } from './record';
import { requestLoggingMiddleware } from './request-log';
import { METRIC_NAMES } from './types';

describe('observability hooks', () => {
  it('records request, error, latency, job, AI, and notification metrics', () => {
    const metrics = new MemoryMetrics();

    metrics.increment(METRIC_NAMES.HTTP_REQUESTS, 1, { method: 'GET', status: '200' });
    metrics.timing(METRIC_NAMES.HTTP_LATENCY, 12, { method: 'GET' });
    metrics.increment(METRIC_NAMES.HTTP_ERRORS, 1, { method: 'GET', status: '500' });
    recordJobMetric(metrics, { job: 'email.send', status: 'completed', durationMs: 40 });
    recordAiCall(metrics, { provider: 'mock', operation: 'summarize', latencyMs: 9, success: true });
    recordNotificationDelivery(metrics, { channel: 'email', status: 'sent' });

    expect(metrics.samples.map((sample) => sample.name)).toEqual([
      METRIC_NAMES.HTTP_REQUESTS,
      METRIC_NAMES.HTTP_LATENCY,
      METRIC_NAMES.HTTP_ERRORS,
      METRIC_NAMES.JOBS_STATUS,
      METRIC_NAMES.JOBS_LATENCY,
      METRIC_NAMES.AI_CALLS,
      METRIC_NAMES.AI_LATENCY,
      METRIC_NAMES.NOTIFICATION_DELIVERY,
    ]);
  });

  it('captures exceptions through an optional error tracker', () => {
    const errors = new MemoryErrorTracker();
    const boom = new Error('boom');
    errors.captureException(boom, { requestId: 'req-1', module: 'http' });
    expect(errors.events).toEqual([{ error: boom, context: { requestId: 'req-1', module: 'http' } }]);
  });

  it('logs HTTP requests with duration and requestId and skips health probes', async () => {
    const entries: Array<{ obj: unknown; message: string }> = [];
    const logger = {
      info: vi.fn((obj: unknown, message: string) => entries.push({ obj, message })),
      warn: vi.fn(),
      error: vi.fn(),
    };
    const metrics = new MemoryMetrics();
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = 'req-http';
      next();
    });
    app.use(requestLoggingMiddleware(logger as never, metrics));
    app.get('/health', (_req, res) => res.status(200).end());
    app.get('/items', (_req, res) => res.status(200).end());

    await request(app).get('/health');
    await request(app).get('/items');

    expect(entries.some((entry) => (entry.obj as { path?: string }).path === '/health')).toBe(false);
    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          message: 'HTTP request',
          obj: expect.objectContaining({
            module: 'http',
            method: 'GET',
            path: '/items',
            statusCode: 200,
            requestId: 'req-http',
          }),
        }),
      ]),
    );
    expect(metrics.samples.some((sample) => sample.name === METRIC_NAMES.HTTP_REQUESTS)).toBe(true);
  });
});
