import { JOB_NAMES } from '../constants';
import { toPublicJobStatus } from '../jobs/status';
import type { JobStatusRecord } from '../jobs/queue.types';
import { eventIdFor } from '../events';
import type {
  AutomationStatusEvent,
  DocumentStatusEvent,
  InAppCreatedEvent,
  RealtimeEventInput,
} from './realtime.types';

const DOCUMENT_JOB_TYPES = new Set<string>([
  JOB_NAMES.DOCUMENT_PROCESS,
  JOB_NAMES.DOCUMENT_ANALYZE,
  JOB_NAMES.AI_ANALYZE,
  JOB_NAMES.RAG_INDEX,
]);

export function eventsFromJobStatus(record: JobStatusRecord): RealtimeEventInput[] {
  const publicStatus = toPublicJobStatus(record);
  const events: RealtimeEventInput[] = [
    {
      channel: 'jobs',
      type: 'job.updated',
      id: eventIdFor('job.updated', `${record.jobId}:${record.status}:${record.progress ?? 0}`),
      audience: record.createdBy ? { userId: record.createdBy } : undefined,
      payload: { ...publicStatus },
    },
  ];

  if (DOCUMENT_JOB_TYPES.has(record.type) && record.createdBy) {
    events.push({
      channel: 'documents',
      type: 'document.updated',
      id: eventIdFor('document.updated', `${record.jobId}:${record.status}:${record.progress ?? 0}`),
      audience: { userId: record.createdBy },
      payload: {
        jobId: publicStatus.jobId,
        type: publicStatus.type,
        status: publicStatus.status,
        progress: publicStatus.progress,
        error: publicStatus.error,
      },
    });
  }

  return events;
}

export function eventFromInAppCreated(input: InAppCreatedEvent): RealtimeEventInput {
  return {
    channel: 'notifications',
    type: 'notification.created',
    id: eventIdFor('notification.created', input.id),
    audience: { userId: input.userId },
    payload: {
      id: input.id,
      title: input.title,
      body: input.body,
      type: input.type,
      createdAt: input.createdAt,
      unread: true,
    },
  };
}

export function eventFromAutomationStatus(input: AutomationStatusEvent): RealtimeEventInput {
  return {
    channel: 'automation',
    type: 'automation.updated',
    id: eventIdFor('automation.updated', `${input.executionId}:${input.status}:${input.attempt}`),
    payload: {
      executionId: input.executionId,
      ruleId: input.ruleId,
      status: input.status,
      trigger: input.trigger,
      attempt: input.attempt,
      errorMessage: input.errorMessage ?? null,
    },
  };
}

export function eventFromDocumentStatus(input: DocumentStatusEvent): RealtimeEventInput {
  return {
    channel: 'documents',
    type: 'document.updated',
    id: eventIdFor('document.updated', `${input.documentId}:${input.status}`),
    audience: { userId: input.userId },
    payload: {
      documentId: input.documentId,
      status: input.status,
      documentType: input.documentType,
      requiresReview: input.requiresReview,
      confidence: input.confidence,
    },
  };
}
