import { randomUUID } from 'node:crypto';

import { ANOMALY, JOBS } from '../constants';
import { ExternalServiceError, FeatureDisabledError, NotFoundError, ValidationError } from '../errors';
import { isFeatureEnabled } from '../features';
import type { EventBus } from '../events';
import { eventIdFor } from '../events';
import type { JobQueue } from '../jobs/queue';
import type { NotificationService } from '../notifications';
import { parseWithSchema } from '../schemas/parse';
import type { AppConfig } from '../types/config';
import type { AppLogger } from '../utils/logger';
import type { AuditService } from '../audit/audit.service';
import type { AIService } from '../integrations/ai';
import { resolveAnomalyRuntimeConfig, type AnomalyRuntimeConfig } from './anomaly.config';
import { detectAnomaly, normalizePoints, valuesFromPoints } from './anomaly.engine';
import { explainAnomaly } from './anomaly.explain';
import {
  anomalyEvaluateBodySchema,
  anomalyEvaluateJobPayloadSchema,
  anomalyListQuerySchema,
} from './anomaly.schemas';
import { createMemoryAnomalyStore } from './stores/memory.store';
import type {
  AnomalyEvaluateInput,
  AnomalyEvaluateResult,
  AnomalyInsight,
  AnomalyStore,
  AnomalyStoreListQuery,
} from './anomaly.types';
import { ANOMALY_EVALUATE_JOB } from './anomaly.types';

export interface AnomalyServiceOptions {
  config: AppConfig;
  logger: AppLogger;
  ai?: AIService | null;
  jobs?: JobQueue | null;
  audit?: AuditService | null;
  events?: EventBus | null;
  notifications?: NotificationService | null;
  store?: AnomalyStore | null;
  runtime?: AnomalyRuntimeConfig;
}

export class AnomalyService {
  readonly runtime: AnomalyRuntimeConfig;
  private readonly config: AppConfig;
  private readonly logger: AppLogger;
  private readonly ai: AIService | null;
  private readonly jobs: JobQueue | null;
  private readonly audit: AuditService | null;
  private readonly events: EventBus | null;
  private readonly notifications: NotificationService | null;
  private readonly store: AnomalyStore;

  constructor(options: AnomalyServiceOptions) {
    this.config = options.config;
    this.logger = options.logger;
    this.ai = options.ai ?? null;
    this.jobs = options.jobs ?? null;
    this.audit = options.audit ?? null;
    this.events = options.events ?? null;
    this.notifications = options.notifications ?? null;
    this.runtime = options.runtime ?? resolveAnomalyRuntimeConfig(options.config);
    this.store = options.store ?? createMemoryAnomalyStore();
  }

  get enabled(): boolean {
    return isFeatureEnabled(this.config, 'anomalyDetection');
  }

  registerJobs(): void {
    this.jobs?.process(ANOMALY_EVALUATE_JOB, async (payload) => {
      const job = parseWithSchema(anomalyEvaluateJobPayloadSchema, payload, {
        source: 'job',
        message: 'Invalid anomaly evaluate job payload',
      });
      await this.evaluateNow(job);
    });
  }

  async evaluate(input: AnomalyEvaluateInput): Promise<AnomalyEvaluateResult> {
    this.assertReady();
    const parsed = parseWithSchema(anomalyEvaluateBodySchema, input, {
      source: 'body',
      message: 'Invalid anomaly evaluate request',
    });
    this.assertPointCount(parsed.points);

    if (parsed.async === true) {
      if (!this.jobs) {
        throw new ExternalServiceError('Job queue is not configured', { provider: 'jobs' });
      }

      const jobId = await this.jobs.enqueue(
        ANOMALY_EVALUATE_JOB,
        {
          ...parsed,
          userId: input.userId,
        },
        {
          attempts: ANOMALY.JOB_ATTEMPTS,
          backoffMs: ANOMALY.JOB_BACKOFF_MS,
          timeoutMs: JOBS.DEFAULT_TIMEOUT_MS,
        },
      );

      return {
        id: randomUUID(),
        metric: parsed.metric,
        anomaly: false,
        severity: 'NONE',
        change: null,
        evidence: {
          sampleSize: Array.isArray(parsed.points) ? parsed.points.length : 0,
          latest: 0,
          baseline: null,
          change: null,
          fired: [],
          skipped: [],
          detectors: [],
          sufficientSample: false,
          claimsStatisticalSignificance: false,
          insufficientData: true,
        },
        explanation: 'Evaluation queued.',
        recommendedAction: 'Poll job status for the completed finding.',
        explanationStatus: 'skipped',
        createdAt: new Date().toISOString(),
        status: 'processing',
        jobId,
      };
    }

    return this.evaluateNow({ ...parsed, userId: input.userId });
  }

  async getFinding(id: string, userId?: string): Promise<AnomalyInsight> {
    this.assertReady();
    const finding = await this.store.get(id);
    if (!finding || !ownsAnomalyFinding(finding.createdBy, userId)) {
      throw new NotFoundError('Anomaly finding not found', { id });
    }
    return finding;
  }

  async listFindings(query: AnomalyStoreListQuery) {
    this.assertReady();
    const parsed = parseWithSchema(anomalyListQuerySchema, query, {
      source: 'query',
      message: 'Invalid anomaly list query',
    });
    return this.store.list({
      ...parsed,
      createdBy: query.createdBy,
    });
  }

  private async evaluateNow(input: AnomalyEvaluateInput): Promise<AnomalyEvaluateResult> {
    this.assertReady();
    const parsed = parseWithSchema(anomalyEvaluateBodySchema, input, {
      source: 'body',
      message: 'Invalid anomaly evaluate request',
    });
    this.assertPointCount(parsed.points);
    const series = normalizePoints(parsed.points);
    const values = valuesFromPoints(series);
    const verdict = detectAnomaly(values, parsed.detectors, this.runtime);
    const shouldExplain = parsed.explain ?? this.runtime.explain;
    const narrative = await explainAnomaly({
      metric: parsed.metric,
      verdict,
      ai: this.ai,
      explain: shouldExplain,
      logger: this.logger,
    });

    const finding: AnomalyInsight = {
      id: randomUUID(),
      metric: parsed.metric,
      anomaly: verdict.anomaly,
      severity: verdict.severity,
      change: verdict.change,
      evidence: verdict.evidence,
      explanation: narrative.explanation,
      recommendedAction: narrative.recommendedAction,
      explanationStatus: narrative.explanationStatus,
      series,
      metadata: parsed.metadata,
      createdAt: new Date().toISOString(),
      createdBy: input.userId,
    };

    const saved = await this.store.save(finding);

    await this.audit?.record({
      actorId: input.userId,
      action: ANOMALY.AUDIT_EVALUATE,
      resource: 'anomaly',
      resourceId: saved.id,
      status: saved.anomaly ? 'anomaly' : 'clear',
      metadata: {
        metric: saved.metric,
        anomaly: saved.anomaly,
        severity: saved.severity,
        change: saved.change,
        explanationStatus: saved.explanationStatus,
        fired: saved.evidence.fired,
        insufficientData: saved.evidence.insufficientData,
      },
    });

    if (saved.anomaly) {
      await this.emitDetected(saved, input.userId);
      if (parsed.notify) {
        await this.notifyActor(saved, input.userId);
      }
    }

    this.logger.info(
      {
        module: 'anomaly',
        operation: 'evaluate',
        metric: saved.metric,
        anomaly: saved.anomaly,
        severity: saved.severity,
        explanationStatus: saved.explanationStatus,
      },
      'Anomaly evaluation completed',
    );

    return { ...saved, status: 'evaluated' };
  }

  private async emitDetected(finding: AnomalyInsight, userId?: string): Promise<void> {
    if (!this.events || !isFeatureEnabled(this.config, 'automation')) {
      return;
    }

    try {
      await this.events.emit({
        type: ANOMALY.EVENT_DETECTED,
        id: eventIdFor(ANOMALY.EVENT_DETECTED, finding.id),
        payload: {
          findingId: finding.id,
          metric: finding.metric,
          anomaly: finding.anomaly,
          severity: finding.severity,
          change: finding.change,
          userId: userId ?? finding.createdBy,
          title: `${finding.severity} anomaly on ${finding.metric}`,
          body: `${finding.metric} changed ${finding.change ?? 'n/a'}% (${finding.severity}).`,
        },
      });
    } catch (error) {
      this.logger.warn({ err: error, findingId: finding.id }, 'Failed to emit anomaly.detected');
    }
  }

  private async notifyActor(finding: AnomalyInsight, userId?: string): Promise<void> {
    if (!this.notifications || !isFeatureEnabled(this.config, 'notifications')) {
      return;
    }
    const target = userId ?? finding.createdBy;
    if (!target) {
      return;
    }

    try {
      await this.notifications.notify({
        userId: target,
        type: finding.severity === 'HIGH' ? 'warning' : 'info',
        title: `${finding.severity} anomaly on ${finding.metric}`,
        body: `${finding.metric} changed ${finding.change ?? 'n/a'}%. ${finding.recommendedAction}`,
      });
    } catch (error) {
      this.logger.warn({ err: error, findingId: finding.id }, 'Failed to record anomaly notification');
    }
  }

  private assertPointCount(points: AnomalyEvaluateInput['points']): void {
    if (points.length > this.runtime.maxPoints) {
      throw new ValidationError('Too many points', [
        {
          path: 'points',
          message: `Provide at most ${this.runtime.maxPoints} points`,
          code: 'too_big',
        },
      ]);
    }
  }

  private assertReady(): void {
    if (!this.enabled) {
      throw new FeatureDisabledError('anomalyDetection');
    }
  }
}

export function createAnomalyService(options: AnomalyServiceOptions): AnomalyService {
  const service = new AnomalyService(options);
  service.registerJobs();
  return service;
}

function ownsAnomalyFinding(createdBy: string | undefined, userId: string | undefined): boolean {
  if (!userId) {
    return true;
  }

  return createdBy === userId;
}
