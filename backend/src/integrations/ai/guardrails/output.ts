import { applyConfidenceReview } from '../ai.review';
import type { AiDecision } from './types';

const EXECUTABLE_OUTPUT =
  /\b(drop\s+table|truncate\s+table|delete\s+from\b|rm\s+-rf|invoke-expression|powershell\s+-|\/bin\/(?:ba)?sh|child_process|executeodoo)\b/i;

export function containsExecutablePayload(value: unknown): boolean {
  try {
    return EXECUTABLE_OUTPUT.test(JSON.stringify(value) ?? '');
  } catch {
    return false;
  }
}

export function applyStructuredOutputPolicy<T>(data: T): T {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return data;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.confidence !== 'number' || typeof record.requiresReview !== 'boolean') {
    return data;
  }

  return applyConfidenceReview(data as T & { confidence: number; requiresReview: boolean });
}

export function applyDecisionPolicy<T extends Record<string, unknown>>(output: {
  result?: T;
  confidence: number;
  evidence?: string[];
  requiresReview?: boolean;
}): AiDecision<T> {
  const reviewed = applyConfidenceReview({
    confidence: output.confidence,
    requiresReview: output.requiresReview ?? false,
  });

  return {
    result: (output.result ?? {}) as T,
    confidence: reviewed.confidence,
    evidence: output.evidence ?? [],
    requiresReview: reviewed.requiresReview || containsExecutablePayload(output.result),
  };
}

export function isDecisionEnvelope(value: unknown): value is AiDecision {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.confidence === 'number' &&
    typeof record.requiresReview === 'boolean' &&
    Array.isArray(record.evidence) &&
    record.result !== undefined &&
    typeof record.result === 'object' &&
    record.result !== null &&
    !Array.isArray(record.result)
  );
}
