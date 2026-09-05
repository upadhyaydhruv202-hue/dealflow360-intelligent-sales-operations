import { describe, expect, it, vi } from 'vitest';

import { ExternalServiceError } from '../../errors';
import { BrevoEmailProvider } from './providers/brevo.provider';
import { ResendEmailProvider } from './providers/resend.provider';

describe('ResendEmailProvider', () => {
  it('posts to the Resend API', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: 're_123' }), { status: 200 }));
    const provider = new ResendEmailProvider({
      apiKey: 're_test',
      from: 'noreply@example.com',
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const sent = await provider.send({
      to: 'ada@example.com',
      subject: 'Hello',
      text: 'Hi',
    });

    expect(sent).toMatchObject({ id: 're_123', provider: 'resend' });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('maps provider rejection to ExternalServiceError', async () => {
    const provider = new ResendEmailProvider({
      apiKey: 're_test',
      from: 'noreply@example.com',
      timeoutMs: 1000,
      fetchImpl: (async () => new Response('nope', { status: 401 })) as unknown as typeof fetch,
    });

    await expect(
      provider.send({ to: 'ada@example.com', subject: 'Hello', text: 'Hi' }),
    ).rejects.toBeInstanceOf(ExternalServiceError);
  });
});

describe('BrevoEmailProvider', () => {
  it('posts to the Brevo API', async () => {
    const fetchImpl = vi.fn(
      async () => new Response(JSON.stringify({ messageId: 'brevo-1' }), { status: 201 }),
    );
    const provider = new BrevoEmailProvider({
      apiKey: 'brevo_test',
      from: 'noreply@example.com',
      timeoutMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const sent = await provider.send({
      to: ['ada@example.com'],
      subject: 'Hello',
      text: 'Hi',
    });

    expect(sent).toMatchObject({ id: 'brevo-1', provider: 'brevo', to: ['ada@example.com'] });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
