import { describe, expect, it } from 'vitest';

import { loadConfig } from '../config';
import { createLogger, loggerBindings } from './logger';
import { runWithJobContext, runWithRequestContext } from './request-context';

describe('structured logging', () => {
  it('includes requestId and jobId from async context', () => {
    expect(loggerBindings()).toEqual({});

    runWithRequestContext({ requestId: 'req-log' }, () => {
      expect(loggerBindings()).toEqual({ requestId: 'req-log' });
    });

    runWithJobContext({ requestId: 'req-job', jobId: 'job-9' }, () => {
      expect(loggerBindings()).toEqual({ requestId: 'req-job', jobId: 'job-9' });
    });
  });

  it('writes JSON logs with level, message, requestId, and redacted secrets', async () => {
    const chunks: string[] = [];
    const logger = createLogger(
      loadConfig({ NODE_ENV: 'test', APP_NAME: 'Hackathon Starter Kit', LOG_LEVEL: 'info' }),
      {
        write(msg: string) {
          chunks.push(msg);
        },
      },
    );

    runWithRequestContext({ requestId: 'req-json', jobId: 'job-json' }, () => {
      logger.info({ module: 'audit', durationMs: 15, password: 'hunter2' }, 'structured sample');
    });

    await new Promise((resolve) => setImmediate(resolve));
    const parsed = JSON.parse(chunks.join('')) as Record<string, unknown>;
    expect(parsed).toMatchObject({
      level: 30,
      msg: 'structured sample',
      requestId: 'req-json',
      jobId: 'job-json',
      module: 'audit',
      durationMs: 15,
    });
    expect(parsed.password).toBe('[Redacted]');
    expect(chunks.join('')).not.toMatch(/hunter2/);
  });
});
