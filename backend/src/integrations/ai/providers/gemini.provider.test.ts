import { describe, expect, it, vi } from 'vitest';

import { ExternalServiceError, RateLimitError, TimeoutError } from '../../../errors';
import { GeminiAiProvider } from './gemini.provider';
import { aiRuntime, geminiTextResponse, jsonResponse, silentLogger } from '../ai.test-helpers';

function createGemini(fetchImpl: ReturnType<typeof vi.fn>, runtime = aiRuntime({ provider: 'gemini', requestedProvider: 'gemini', apiKey: 'secret-gemini-key', model: 'gemini-2.5-flash' })) {
  return new GeminiAiProvider({
    config: runtime,
    logger: silentLogger,
    fetchImpl,
    sleep: async () => undefined,
  });
}

describe('GeminiAiProvider', () => {
  it('sends generateContent with the API key header and no key in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, geminiTextResponse('Hello there')));
    const provider = createGemini(fetchImpl);

    const result = await provider.generateText({
      operation: 'generateText',
      contents: [{ role: 'user', text: 'Say hello' }],
    });

    expect(result.text).toBe('Hello there');
    expect(result.usage?.totalTokens).toBe(12);

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain('secret-gemini-key');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('secret-gemini-key');
    expect(JSON.parse(String(init.body))).toMatchObject({
      contents: [{ role: 'user', parts: [{ text: 'Say hello' }] }],
    });
  });

  it('sends inline document bytes as Gemini parts', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(jsonResponse(200, geminiTextResponse('{"ok":true}')));
    const provider = createGemini(fetchImpl);

    await provider.generateText({
      operation: 'extract',
      contents: [{ role: 'user', text: 'Extract fields' }],
      json: true,
      attachments: [{ mimeType: 'image/png', data: Buffer.from('png-bytes'), filename: 'scan.png' }],
    });

    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.contents[0].parts).toEqual([
      { text: 'Extract fields' },
      { inlineData: { mimeType: 'image/png', data: Buffer.from('png-bytes').toString('base64') } },
    ]);
  });

  it('requests JSON mime type for structured calls', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, geminiTextResponse('{"category":"general","priority":"low","reason":"n/a"}')),
    );
    const provider = createGemini(fetchImpl);

    await provider.generateText({
      operation: 'generateStructured',
      contents: [{ role: 'user', text: 'Classify' }],
      json: true,
    });

    const body = JSON.parse(String((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
  });

  it('maps timeouts', async () => {
    const fetchImpl = vi.fn().mockImplementationOnce(async () => {
      const error = new Error('aborted');
      error.name = 'TimeoutError';
      throw error;
    });

    await expect(
      createGemini(fetchImpl, aiRuntime({ provider: 'gemini', requestedProvider: 'gemini', apiKey: 'k', maxRetries: 0 })).generateText({
        operation: 'generateText',
        contents: [{ role: 'user', text: 'Hello' }],
      }),
    ).rejects.toBeInstanceOf(TimeoutError);
  });

  it('maps rate limits and server failures', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: { message: 'RESOURCE_EXHAUSTED' } }, { 'retry-after': '0' }))
      .mockResolvedValueOnce(jsonResponse(500, { error: { message: 'internal' } }));

    const provider = createGemini(
      fetchImpl,
      aiRuntime({ provider: 'gemini', requestedProvider: 'gemini', apiKey: 'k', maxRetries: 0 }),
    );

    await expect(
      provider.generateText({ operation: 'generateText', contents: [{ role: 'user', text: 'Hello' }] }),
    ).rejects.toBeInstanceOf(RateLimitError);

    await expect(
      provider.generateText({ operation: 'generateText', contents: [{ role: 'user', text: 'Hello' }] }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });

  it('does not leak API keys on authentication failures', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(401, { error: { message: 'API key not valid. Please pass a valid API key.' } }),
    );

    try {
      await createGemini(
        fetchImpl,
        aiRuntime({ provider: 'gemini', requestedProvider: 'gemini', apiKey: 'secret-gemini-key', maxRetries: 0 }),
      ).generateText({
        operation: 'generateText',
        contents: [{ role: 'user', text: 'Hello' }],
      });
      throw new Error('expected failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ExternalServiceError);
      expect(JSON.stringify(error)).not.toContain('secret-gemini-key');
      expect((error as ExternalServiceError).message).toBe('AI provider authentication failed');
    }
  });

  it('retries transient 503 failures', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(503, { error: { message: 'unavailable' } }))
      .mockResolvedValueOnce(jsonResponse(200, geminiTextResponse('Recovered')));

    const result = await createGemini(fetchImpl).generateText({
      operation: 'generateText',
      contents: [{ role: 'user', text: 'Hello' }],
    });

    expect(result.text).toBe('Recovered');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats empty SAFETY responses as provider errors', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }],
      }),
    );

    await expect(
      createGemini(fetchImpl, aiRuntime({ provider: 'gemini', requestedProvider: 'gemini', apiKey: 'k', maxRetries: 0 })).generateText({
        operation: 'generateText',
        contents: [{ role: 'user', text: 'Hello' }],
      }),
    ).rejects.toMatchObject({ message: expect.stringMatching(/refused/i) });
  });

  it('embeds text through embedContent without putting the key in the URL', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, { embedding: { values: [0.1, 0.2, 0.3] } }),
    );
    const provider = createGemini(fetchImpl);

    const result = await provider.embed({ text: 'hello' });

    expect(result).toEqual({
      embedding: [0.1, 0.2, 0.3],
      model: 'gemini-embedding-001',
      provider: 'gemini',
    });
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent',
    );
    expect(url).not.toContain('secret-gemini-key');
    expect(JSON.parse(String(init.body))).toEqual({
      content: { parts: [{ text: 'hello' }] },
    });
  });
});
