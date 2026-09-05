import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export interface RequestContext {
  requestId: string;
  jobId?: string;
  actorId?: string;
  ip?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

export function getRequestId(): string | undefined {
  return storage.getStore()?.requestId;
}

export function setRequestActor(actorId: string | undefined): void {
  const store = storage.getStore();
  if (store && actorId) {
    store.actorId = actorId;
  }
}

export function withRequestId<T extends Record<string, unknown>>(payload: T): T & { requestId: string } {
  return {
    ...payload,
    requestId: getRequestId() ?? randomUUID(),
  };
}

export function runWithJobContext<T>(payload: { requestId?: string; jobId?: string }, fn: () => T): T {
  return runWithRequestContext(
    {
      requestId: payload.requestId ?? randomUUID(),
      jobId: payload.jobId,
    },
    fn,
  );
}

export function getAuditContext(): { requestId?: string; ip?: string; actorId?: string; jobId?: string } {
  const ctx = storage.getStore();
  if (!ctx) {
    return {};
  }

  return {
    ...(ctx.requestId ? { requestId: ctx.requestId } : {}),
    ...(ctx.ip ? { ip: ctx.ip } : {}),
    ...(ctx.actorId ? { actorId: ctx.actorId } : {}),
    ...(ctx.jobId ? { jobId: ctx.jobId } : {}),
  };
}
