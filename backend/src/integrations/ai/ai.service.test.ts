import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import {
  ExternalServiceError,
  RateLimitError,
  TimeoutError,
  ValidationError,
} from '../../errors';
import { aiInsightSchema } from './ai.schemas';
import { aiTestConfig, createTestService, silentLogger } from './ai.test-helpers';
import { createAiService } from './ai.service';
import { MockAiProvider } from './providers/mock.provider';

describe('AIService', () => {
  it('generates text through the mocked provider', async () => {
    const { service, provider } = createTestService();
    provider.enqueue('Hello from mock');

    const result = await service.generateText({ prompt: 'Say hello' });

    expect(result.text).toBe('Hello from mock');
    expect(result.provider).toBe('mock');
    expect(result.model).toBe('mock');
  });

  it('returns a default mock response when nothing is queued', async () => {
    const { service } = createTestService();
    const result = await service.generateText({ prompt: 'Anything' });
    expect(result.text).toMatch(/mock/i);
  });

  it('maps provider failures', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(new ExternalServiceError('Gemini is unavailable', { provider: 'gemini', status: 503 }));

    await expect(service.generateText({ prompt: 'Hello' })).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('maps provider timeouts', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(new TimeoutError('AI request timed out', { provider: 'gemini' }));

    await expect(service.generateText({ prompt: 'Hello' })).rejects.toBeInstanceOf(TimeoutError);
  });

  it('maps provider rate limits', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(new RateLimitError('AI provider rate limit exceeded', { provider: 'gemini' }));

    await expect(service.generateText({ prompt: 'Hello' })).rejects.toBeInstanceOf(RateLimitError);
  });

  it('rejects malformed structured output', async () => {
    const provider = new MockAiProvider();
    provider.enqueue('not-json');
    provider.enqueue('still not json');
    const { service } = createTestService({ provider });

    await expect(
      service.generateStructured({
        prompt: 'Classify this ticket',
        schema: aiInsightSchema,
        schemaName: 'insight',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects structured output that does not match the schema', async () => {
    const provider = new MockAiProvider();
    provider.enqueue(JSON.stringify({ category: 'delivery_delay' }));
    provider.enqueue(JSON.stringify({ category: 'delivery_delay' }));
    const { service } = createTestService({ provider });

    await expect(
      service.generateStructured({
        prompt: 'Classify this ticket',
        schema: aiInsightSchema,
        schemaName: 'insight',
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('validates successful structured output before returning it', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(
      JSON.stringify({
        category: 'delivery_delay',
        priority: 'high',
        reason: 'The shipment missed the promised window.',
      }),
    );

    const result = await service.generateStructured({
      prompt: 'Classify this ticket',
      schema: aiInsightSchema,
      schemaName: 'insight',
    });

    expect(result.data).toEqual({
      category: 'delivery_delay',
      priority: 'high',
      reason: 'The shipment missed the promised window.',
    });
  });

  it('retries malformed JSON once then succeeds', async () => {
    const { service, provider } = createTestService();
    provider.enqueue('```not json```');
    provider.enqueue(
      JSON.stringify({
        category: 'billing',
        priority: 'low',
        reason: 'Recovered after a parse retry.',
      }),
    );

    const result = await service.generateStructured({
      prompt: 'Classify',
      schema: aiInsightSchema,
    });

    expect(result.data.category).toBe('billing');
  });

  it('summarizes, classifies, extracts, analyzes, and recommends with the mock provider', async () => {
    const { service } = createTestService();

    const summary = await service.summarize({ text: 'A long customer email about a late parcel.' });
    expect(summary.data.summary).toMatch(/summary/i);
    expect(summary.data.keyPoints.length).toBeGreaterThan(0);
    expect(summary.data.actions).toEqual([]);

    const classified = await service.classify({
      text: 'The package is two days late.',
      labels: ['delivery_delay', 'billing'],
    });
    expect(classified.data).toEqual(
      expect.objectContaining({
        category: 'delivery_delay',
        priority: 'medium',
        sentiment: 'neutral',
        confidence: 0.9,
        reason: expect.any(String),
      }),
    );

    const extracted = await service.extract({
      text: 'Order 99 arrives Friday.',
      fields: ['orderId', 'arrival'],
    });
    expect(extracted.data.fields).toEqual({
      orderId: 'sample orderId',
      arrival: 'sample arrival',
    });
    expect(extracted.data.missingFields).toEqual([]);
    expect(extracted.data.requiresReview).toBe(false);

    const analysis = await service.analyze({ text: 'The customer is frustrated but polite.' });
    expect(analysis.data.sentiment).toBe('neutral');
    expect(analysis.data.priority).toBe('medium');
    expect(analysis.data.summary).toBeTruthy();
    expect(analysis.data.risks).toEqual([]);

    const recs = await service.recommend({ context: 'Warehouse throughput dropped 20%.' });
    expect(recs.data.recommendations[0]).toEqual(
      expect.objectContaining({
        recommendation: expect.any(String),
        reason: expect.any(String),
        confidence: expect.any(Number),
      }),
    );
  });

  it('accepts content as an alias for text', async () => {
    const { service } = createTestService();
    const summary = await service.summarize({
      content: 'A warehouse delay notice.',
      style: 'executive',
      length: 'short',
      language: 'en',
    });
    expect(summary.data.summary).toBeTruthy();
  });

  it('extracts entities and action items through named schemas', async () => {
    const { service } = createTestService();

    const entities = await service.extract({
      content: 'Alice from Acme met Bob in Paris on 2026-08-01 about invoice INV-9.',
      schemaName: 'entities',
    });
    expect(entities.data.fields).toEqual(
      expect.objectContaining({
        people: expect.any(Array),
        organizations: expect.any(Array),
      }),
    );

    const actions = await service.extract({
      content: 'Please follow up with the customer by Friday.',
      schemaName: 'actionItems',
    });
    expect(actions.data.fields).toEqual(
      expect.objectContaining({
        actionItems: expect.arrayContaining([expect.objectContaining({ action: expect.any(String) })]),
      }),
    );
    expect(actions.data.requiresReview).toBe(true);
  });

  it('analyzes risk and drafts a response for review', async () => {
    const { service } = createTestService();

    const risk = await service.analyze({
      content: 'The shipment may miss the SLA.',
      focus: 'risk',
    });
    expect(risk.data.risks.length).toBeGreaterThan(0);
    expect(risk.data.risks[0]).toEqual(
      expect.objectContaining({
        risk: expect.any(String),
        severity: expect.stringMatching(/low|medium|high/),
      }),
    );

    const draft = await service.draft({
      content: 'Customer asked for an update on order 99.',
      purpose: 'Reply to the customer',
      tone: 'empathetic',
    });
    expect(draft.data.draft).toBeTruthy();
    expect(draft.data.requiresReview).toBe(true);
  });

  it('rejects unknown classification labels', async () => {
    const { service, provider } = createTestService();
    const invalid = JSON.stringify({
      category: 'unknown',
      priority: 'low',
      sentiment: 'neutral',
      confidence: 0.9,
      reason: 'nope',
    });
    provider.enqueue(invalid);
    provider.enqueue(invalid);

    await expect(
      service.classify({
        text: 'Something else',
        labels: ['delivery_delay', 'billing'],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects invalid structured summarize output', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(JSON.stringify({ summary: '' }));
    provider.enqueue(JSON.stringify({ summary: '' }));

    await expect(service.summarize({ content: 'A parcel was delayed.' })).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects extract output that omits the review envelope', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(JSON.stringify({ orderId: '99' }));
    provider.enqueue(JSON.stringify({ orderId: '99' }));

    await expect(
      service.extract({
        content: 'Order 99 arrives Friday.',
        fields: ['orderId', 'arrival'],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('marks missing extract fields and requires review', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(
      JSON.stringify({
        fields: { orderId: '99', arrival: null },
        missingFields: [],
        confidence: 0.9,
        warnings: [],
        requiresReview: false,
      }),
    );

    const extracted = await service.extract({
      content: 'Order 99.',
      fields: ['orderId', 'arrival'],
    });

    expect(extracted.data.fields.orderId).toBe('99');
    expect(extracted.data.missingFields).toEqual(['arrival']);
    expect(extracted.data.requiresReview).toBe(true);
  });

  it('returns low-confidence classification without failing', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(
      JSON.stringify({
        category: 'billing',
        priority: 'low',
        sentiment: 'negative',
        confidence: 0.2,
        reason: 'The content is ambiguous.',
      }),
    );

    const classified = await service.classify({
      content: 'Please look at this.',
      labels: ['delivery_delay', 'billing'],
    });

    expect(classified.data.confidence).toBe(0.2);
    expect(classified.data.category).toBe('billing');
  });

  it('flags low-confidence extract and analysis for review', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(
      JSON.stringify({
        fields: { orderId: '99' },
        missingFields: [],
        confidence: 0.2,
        warnings: ['Uncertain extraction.'],
        requiresReview: false,
      }),
    );
    provider.enqueue(
      JSON.stringify({
        summary: 'Unclear note.',
        findings: ['Not enough detail.'],
        risks: [],
        sentiment: 'neutral',
        priority: 'medium',
        confidence: 0.15,
        requiresReview: false,
      }),
    );

    const extracted = await service.extract({
      content: 'Order 99.',
      fields: ['orderId'],
    });
    expect(extracted.data.requiresReview).toBe(true);

    const analysis = await service.analyze({ content: 'Unclear note.' });
    expect(analysis.data.requiresReview).toBe(true);
    expect(analysis.data.confidence).toBe(0.15);
  });

  it('forces drafted responses to require review', async () => {
    const { service, provider } = createTestService();
    provider.enqueue(
      JSON.stringify({
        draft: 'We will look into this.',
        alternatives: [],
        warnings: [],
        confidence: 0.99,
        requiresReview: false,
      }),
    );

    const draft = await service.draft({ content: 'Customer complaint.' });
    expect(draft.data.requiresReview).toBe(true);
  });

  it('rejects invalid input before calling the provider', async () => {
    const provider = new MockAiProvider();
    const generateText = vi.spyOn(provider, 'generateText');
    const { service } = createTestService({ provider });

    await expect(service.generateText({ prompt: '' })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.classify({ text: 'x', labels: ['only-one'] })).rejects.toBeInstanceOf(ValidationError);
    await expect(
      service.generateText({
        messages: [
          { role: 'user', content: 'a'.repeat(60_000) },
          { role: 'assistant', content: 'b'.repeat(60_000) },
        ],
      }),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(generateText).not.toHaveBeenCalled();
  });

  it('fails closed when AI is disabled', async () => {
    const { service } = createTestService({
      runtime: { enabled: false, ready: false },
    });

    await expect(service.checkConnectivity()).resolves.toMatchObject({
      configured: false,
      skipped: true,
      healthy: true,
    });
    await expect(service.generateText({ prompt: 'Hello' })).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('reports an unhealthy check when the provider is not configured', async () => {
    const { service } = createTestService({
      runtime: { enabled: true, ready: false, provider: 'gemini', requestedProvider: 'gemini' },
    });

    await expect(service.checkConnectivity()).resolves.toMatchObject({
      configured: true,
      healthy: false,
      skipped: false,
    });
  });

  it('returns a deterministic embedding from the mock provider', async () => {
    const { service } = createTestService();
    const first = await service.embed({ text: 'hello' });
    const second = await service.embed({ text: 'hello' });
    const other = await service.embed({ text: 'goodbye' });

    expect(first.provider).toBe('mock');
    expect(first.embedding.length).toBeGreaterThan(0);
    expect(first.embedding).toEqual(second.embedding);
    expect(first.embedding).not.toEqual(other.embedding);
  });
});

describe('custom output schema', () => {
  it('accepts a caller-supplied zod schema', async () => {
    const schema = z.object({
      score: z.number().min(0).max(1),
      label: z.string().min(1),
    });
    const { service, provider } = createTestService();
    provider.enqueue(JSON.stringify({ score: 0.8, label: 'ok' }));

    const result = await service.generateStructured({
      prompt: 'Score this',
      schema,
    });

    expect(result.data).toEqual({ score: 0.8, label: 'ok' });
  });
});

describe('createAiService factory wiring', () => {
  it('uses the mock provider from config the same way createApp does', async () => {
    const service = createAiService({
      config: aiTestConfig(),
      logger: silentLogger,
    });

    expect(service.ready).toBe(true);
    await expect(service.checkConnectivity()).resolves.toMatchObject({
      configured: true,
      healthy: true,
      skipped: false,
    });

    const text = await service.generateText({ prompt: 'Hello' });
    expect(text.provider).toBe('mock');
    expect(text.text).toMatch(/mock/i);

    const insight = await service.generateStructured({
      prompt: 'A delivery is two days late.',
      schema: aiInsightSchema,
      schemaName: 'insight',
    });
    expect(insight.data).toEqual(
      expect.objectContaining({
        category: expect.any(String),
        priority: expect.stringMatching(/low|medium|high/),
        reason: expect.any(String),
      }),
    );
  });
});
