import type { AuthenticatedUser } from '../auth/types';

export interface DomainEvent {
  id: string;
  type: string;
  occurredAt: string;
  payload: Record<string, unknown>;
  actor?: AuthenticatedUser;
  requestId?: string;
}

export type DomainEventInput = {
  type: string;
  payload?: Record<string, unknown>;
  id?: string;
  actor?: AuthenticatedUser;
  requestId?: string;
  occurredAt?: string;
};

export type DomainEventHandler = (event: DomainEvent) => void | Promise<void>;
