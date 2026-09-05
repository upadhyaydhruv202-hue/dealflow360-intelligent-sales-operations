import { API_PATHS } from '@hackathon/api-contract';

import { apiGet, joinApiPath } from './api';

export const REALTIME_CHANNELS = [
  'jobs',
  'notifications',
  'dashboard',
  'automation',
  'documents',
] as const;

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[number];

export interface RealtimeChannelInfo {
  name: RealtimeChannel;
  description: string;
  permission: string;
}

export interface RealtimeEvent {
  id: string;
  channel: RealtimeChannel;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface RealtimeReady {
  connectionId: string;
  channels: RealtimeChannel[];
  heartbeatSeconds: number;
}

const DEFAULT_BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function getRealtimeChannels(token: string) {
  return apiGet<{ channels: RealtimeChannelInfo[] }>(API_PATHS.realtime.channels, token);
}

export function subscribeRealtime(options: {
  token: string;
  channels?: readonly string[];
  signal?: AbortSignal;
  onEvent: (event: RealtimeEvent) => void;
  onReady?: (ready: RealtimeReady) => void;
  baseUrl?: string;
}): Promise<void> {
  const params: Record<string, string> = {};
  if (options.channels && options.channels.length > 0) {
    params.channels = options.channels.join(',');
  }
  const url = `${options.baseUrl ?? DEFAULT_BASE_URL}${joinApiPath(API_PATHS.realtime.events, params)}`;

  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${options.token}`,
    },
    credentials: 'include',
    signal: options.signal,
  }).then(async (response) => {
    if (!response.ok || !response.body) {
      throw new Error(`Realtime connection failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeSse(buffer);
      buffer = parsed.rest;
      for (const block of parsed.blocks) {
        if (block.event === 'ready' && block.data) {
          options.onReady?.(JSON.parse(block.data) as RealtimeReady);
          continue;
        }
        if (!block.data || !block.event || block.event === 'ping') {
          continue;
        }
        options.onEvent(JSON.parse(block.data) as RealtimeEvent);
      }
    }
  });
}

function consumeSse(input: string): { blocks: Array<{ event?: string; data?: string }>; rest: string } {
  const parts = input.split('\n\n');
  const rest = parts.pop() ?? '';
  const blocks = parts.map((chunk) => {
    const block: { event?: string; data?: string } = {};
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) {
        block.event = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        block.data = line.slice(5).trim();
      }
    }
    return block;
  });
  return { blocks, rest };
}
