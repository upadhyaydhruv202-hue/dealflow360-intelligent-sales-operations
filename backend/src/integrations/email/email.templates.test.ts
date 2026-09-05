import { describe, expect, it } from 'vitest';

import { loadConfig } from '../../config';
import { silentLogger, createTestService } from '../ai/ai.test-helpers';
import { createEmailService } from './email.service';
import { mergeGeneratedEmail, splitVerifiedFacts } from './email.generate';
import { EMAIL_TEMPLATE_IDS } from './email.types';
import { listEmailTemplates, renderEmailTemplate } from './templates';

describe('email templates', () => {
  it('registers the reusable catalog', () => {
    expect(listEmailTemplates().map((item) => item.id)).toEqual([...EMAIL_TEMPLATE_IDS]);
  });

  it('interpolates verified variables and leaves unknown placeholders empty', () => {
    const rendered = renderEmailTemplate('otp', {
      appName: 'Starter Kit',
      code: '847291',
      expiresInMinutes: 10,
    });
    expect(rendered.subject).toContain('Starter Kit');
    expect(rendered.text).toContain('847291');
    expect(rendered.text).not.toContain('{{code}}');
  });

  it('escapes HTML in the html body but not in text', () => {
    const rendered = renderEmailTemplate('welcome', {
      displayName: '<script>alert(1)</script>',
      appName: 'Kit',
    });
    expect(rendered.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(rendered.html).not.toContain('<script>');
    expect(rendered.text).toContain('<script>alert(1)</script>');
  });
});

describe('generateEmailContent', () => {
  it('keeps secret facts out of the AI prompt payload', () => {
    const split = splitVerifiedFacts({
      displayName: 'Ada',
      total: '42.00',
      code: '123456',
    });
    expect(split.publicFacts).toEqual({ displayName: 'Ada', total: '42.00' });
    expect(split.secretFacts).toEqual({ code: '123456' });
  });

  it('appends missing verified facts and flags invented numbers', () => {
    const result = mergeGeneratedEmail({
      subject: 'About your order',
      preview: 'Hello',
      body: 'Your total is $99.00',
      warnings: [],
      confidence: 0.8,
      facts: { displayName: 'Ada', total: '42.00' },
      publicFacts: { displayName: 'Ada', total: '42.00' },
      source: 'ai',
    });

    expect(result.requiresReview).toBe(true);
    expect(result.text).toContain('42.00');
    expect(result.warnings.some((item) => item.includes('were not in verifiedFacts'))).toBe(true);
  });

  it('uses AI wording while interpolating verified facts', async () => {
    const { service: ai } = createTestService();
    const email = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', FEATURE_AI: 'true', AI_PROVIDER: 'mock' }),
      logger: silentLogger,
      ai,
    });

    const result = await email.generateEmailContent({
      purpose: 'order update',
      verifiedFacts: { displayName: 'Ada', topic: 'invoice INV-9' },
    });

    expect(result.source).toBe('ai');
    expect(result.requiresReview).toBe(true);
    expect(result.text).toContain('Ada');
    expect(result.text).toContain('invoice INV-9');
    expect(JSON.stringify(result)).not.toMatch(/\$99\.00/);
  });

  it('falls back to a template when AI is disabled', async () => {
    const email = createEmailService({
      config: loadConfig({ NODE_ENV: 'test', DEMO_MODE: 'true', FEATURE_AI: 'false' }),
      logger: silentLogger,
    });

    const result = await email.generateEmailContent({
      purpose: 'Welcome',
      verifiedFacts: { displayName: 'Ada', code: '123456' },
      template: 'welcome',
    });

    expect(result.source).toBe('template');
    expect(result.requiresReview).toBe(true);
    expect(result.text).toContain('Ada');
    expect(result.facts).not.toHaveProperty('code');
    expect(JSON.stringify(result.facts)).not.toContain('123456');
  });
});
