import { afterEach, describe, expect, it, vi } from 'vitest';

import { API_PATHS } from '@hackathon/api-contract';

import { getRealtimeChannels, subscribeRealtime, type RealtimeEvent } from './realtime';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('realtime client', () => {
  it('calls the shared realtime channels path', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL) => ({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        data: { channels: [{ name: 'jobs', description: 'Jobs', permission: 'jobs.read' }] },
        meta: {},
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);
    await getRealtimeChannels('token');
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(API_PATHS.realtime.channels);
  });

  it('parses allowlisted SSE events from a stream', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'event: ready\ndata: {"connectionId":"c1","channels":["jobs"],"heartbeatSeconds":15}\n\n',
          ),
        );
        controller.enqueue(
          encoder.encode(
            'event: job.updated\ndata: {"id":"e1","channel":"jobs","type":"job.updated","occurredAt":"t","payload":{"jobId":"j1"}}\n\n',
          ),
        );
        controller.close();
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        body: stream,
      })),
    );

    const events: RealtimeEvent[] = [];
    let readyId: string | undefined;
    await subscribeRealtime({
      token: 'token',
      onReady: (ready) => {
        readyId = ready.connectionId;
      },
      onEvent: (event) => events.push(event),
    });

    expect(readyId).toBe('c1');
    expect(events).toEqual([
      {
        id: 'e1',
        channel: 'jobs',
        type: 'job.updated',
        occurredAt: 't',
        payload: { jobId: 'j1' },
      },
    ]);
  });
});
