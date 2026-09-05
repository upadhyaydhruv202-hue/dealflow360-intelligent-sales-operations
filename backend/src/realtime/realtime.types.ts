import type { AuthenticatedUser } from '../auth/types';
import { REALTIME_CHANNELS, type RealtimeChannelName } from '../constants';

export const REALTIME_CHANNEL_NAMES = REALTIME_CHANNELS;
export type RealtimeChannel = RealtimeChannelName;

export const REALTIME_EVENT_TYPES = [
  'job.updated',
  'notification.created',
  'dashboard.updated',
  'automation.updated',
  'document.updated',
] as const;
export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export interface RealtimeAudience {
  userId?: string;
}

export interface RealtimeEvent {
  id: string;
  channel: RealtimeChannel;
  type: RealtimeEventType;
  occurredAt: string;
  payload: Record<string, unknown>;
  audience?: RealtimeAudience;
}

export type RealtimeEventInput = {
  channel: RealtimeChannel;
  type: RealtimeEventType;
  payload?: Record<string, unknown>;
  audience?: RealtimeAudience;
  id?: string;
  occurredAt?: string;
};

export interface RealtimeChannelInfo {
  name: RealtimeChannel;
  description: string;
  permission: string;
}

export interface RealtimeSubscriber {
  id: string;
  user: AuthenticatedUser;
  channels: ReadonlySet<RealtimeChannel>;
  send: (event: RealtimeEvent) => void;
}

export interface RealtimeTransport {
  publish(envelope: RealtimeTransportEnvelope): Promise<void>;
  subscribe(handler: (envelope: RealtimeTransportEnvelope) => void): Promise<void>;
  close(): Promise<void>;
}

export interface RealtimeTransportEnvelope {
  sourceId: string;
  event: RealtimeEvent;
}

export interface InAppCreatedEvent {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: string;
}

export interface AutomationStatusEvent {
  executionId: string;
  ruleId: string;
  status: string;
  trigger: string;
  attempt: number;
  errorMessage?: string | null;
}

export interface DocumentStatusEvent {
  documentId: string;
  userId: string;
  status: string;
  documentType?: string;
  requiresReview?: boolean;
  confidence?: number;
}
