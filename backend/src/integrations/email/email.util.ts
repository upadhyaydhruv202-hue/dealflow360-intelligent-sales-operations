import { ExternalServiceError } from '../../errors';
import type { EmailAttachment, EmailProviderName } from './email.types';

export function toRecipientList(to: string | string[]): string[] {
  return Array.isArray(to) ? to : [to];
}

export function toAttachmentBuffers(attachments: EmailAttachment[] | undefined): Array<{
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
}> {
  return (attachments ?? []).map((item) => ({
    filename: item.filename,
    content: Buffer.from(item.content, 'base64'),
    contentType: item.contentType,
    cid: item.cid,
  }));
}

export async function postJsonEmail(options: {
  url: string;
  headers: Record<string, string>;
  payload: unknown;
  timeoutMs: number;
  provider: EmailProviderName;
  fetchImpl?: typeof fetch;
}): Promise<{ id?: unknown; messageId?: unknown }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetchImpl(options.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        ...options.headers,
      },
      body: JSON.stringify(options.payload),
      redirect: 'error',
      signal: controller.signal,
    });

    if (response.status >= 400 && response.status < 500) {
      throw new ExternalServiceError('Email provider rejected the message', {
        provider: options.provider,
        status: response.status,
      });
    }

    if (!response.ok) {
      throw new ExternalServiceError('Failed to send email', {
        provider: options.provider,
        status: response.status,
      });
    }

    return (await response.json().catch(() => ({}))) as { id?: unknown; messageId?: unknown };
  } catch (error) {
    if (error instanceof ExternalServiceError) {
      throw error;
    }
    throw new ExternalServiceError('Failed to send email', { provider: options.provider });
  } finally {
    clearTimeout(timer);
  }
}
