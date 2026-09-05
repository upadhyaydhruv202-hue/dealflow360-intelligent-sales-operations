import type { Response } from 'express';

import type { RealtimeEvent } from './realtime.types';

export function writeSseHeaders(res: Response): void {
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.socket?.setTimeout(0);
  res.socket?.setNoDelay?.(true);
}

export function writeSseEvent(
  res: Response,
  input: { event: string; data: unknown; id?: string; retryMs?: number },
): void {
  if (res.writableEnded) {
    return;
  }
  if (input.retryMs && input.retryMs > 0) {
    res.write(`retry: ${input.retryMs}\n`);
  }
  if (input.id) {
    res.write(`id: ${input.id}\n`);
  }
  res.write(`event: ${input.event}\n`);
  res.write(`data: ${JSON.stringify(input.data)}\n\n`);
}

export function writeSseComment(res: Response, comment = 'ping'): void {
  if (res.writableEnded) {
    return;
  }
  res.write(`: ${comment}\n\n`);
}

export function writeRealtimeEvent(res: Response, event: RealtimeEvent): void {
  writeSseEvent(res, {
    event: event.type,
    id: event.id,
    data: {
      id: event.id,
      channel: event.channel,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
    },
  });
}
