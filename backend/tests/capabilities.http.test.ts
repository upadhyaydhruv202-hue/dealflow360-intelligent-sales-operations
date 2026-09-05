import pino from 'pino';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { defineCapability } from '../src/capabilities';
import { definePlatformPlugin } from '../src/platform';

const logger = pino({ level: 'silent' });

describe('GET /api/v1/capabilities', () => {
  it('returns the catalog with enabled flags and plugin capabilities', async () => {
    const { app, capabilities, pluginNames } = createApp({
      config: loadConfig({
        NODE_ENV: 'test',
        APP_NAME: 'Hackathon Starter Kit',
        FEATURE_AI: 'true',
        AI_PROVIDER: 'mock',
      }),
      logger,
      plugins: [
        definePlatformPlugin({
          name: 'test.http',
          capabilities: [
            defineCapability({
              name: 'plugin.http',
              kind: 'application',
              category: 'core',
              maturity: 'beta',
              summary: 'Plugin capability visible on the public catalog endpoint.',
              documentation: ['docs/capabilities.md'],
            }),
          ],
        }),
      ],
    });

    expect(pluginNames).toEqual(['test.http']);
    expect(capabilities.has('plugin.http')).toBe(true);
    expect(capabilities.has('problem.dealflow')).toBe(true);

    const response = await request(app).get('/api/v1/capabilities');
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.architecture).toBe('architecture.modular-monolith');
    expect(response.body.data.platformVersion).toBe('0.1.0');
    expect(response.body.data.versions).toEqual({
      platform: '0.1.0',
      capability: '0.1.0',
      profile: '0.1.0',
      plugin: '0.1.0',
    });
    const profileNames = response.body.data.profiles.map((item: { name: string }) => item.name);
    expect(profileNames).toContain('profile.basic-web');
    expect(profileNames).toContain('profile.enterprise-application');
    const names = response.body.data.capabilities.map((item: { name: string }) => item.name);
    expect(names).toContain('auth');
    expect(names).toContain('plugin.http');
    expect(names).toContain('problem.dealflow');
    const ai = response.body.data.capabilities.find((item: { name: string }) => item.name === 'ai');
    expect(ai.enabled).toBe(true);
    const rag = response.body.data.capabilities.find(
      (item: { name: string }) => item.name === 'rag',
    );
    expect(rag.enabled).toBe(false);
  });
});
