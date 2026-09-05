import { AI_GUARDRAILS } from '../../constants';
import type { AiDraft } from './ai.types';

export const AI_LOW_CONFIDENCE_THRESHOLD = AI_GUARDRAILS.LOW_CONFIDENCE_THRESHOLD;

export function isLowConfidence(confidence: number): boolean {
  return confidence < AI_LOW_CONFIDENCE_THRESHOLD;
}

export function isMissingExtractedValue(value: unknown): boolean {
  if (value == null) {
    return true;
  }

  return typeof value === 'string' && value.trim() === '';
}

export function collectMissingFields(
  fields: Record<string, unknown>,
  requestedFields: string[] | undefined,
  reported: string[],
): string[] {
  const missing = new Set(reported.map((field) => field.trim()).filter(Boolean));
  const keys = requestedFields ?? [];

  for (const field of keys) {
    if (isMissingExtractedValue(fields[field])) {
      missing.add(field);
    }
  }

  return [...missing];
}

export function applyExtractReview<T extends {
  fields: object;
  missingFields: string[];
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
}>(output: T, requestedFields?: string[]): T {
  const fields = output.fields as Record<string, unknown>;
  const missingFields = collectMissingFields(fields, requestedFields, output.missingFields);

  return {
    ...output,
    missingFields,
    requiresReview: output.requiresReview || isLowConfidence(output.confidence) || missingFields.length > 0,
  };
}

export function applyDraftReview(output: {
  draft: string;
  subject?: string;
  alternatives?: string[];
  warnings?: string[];
  confidence: number;
  requiresReview: boolean;
}): AiDraft {
  return {
    draft: output.draft,
    subject: output.subject,
    alternatives: output.alternatives ?? [],
    warnings: output.warnings ?? [],
    confidence: output.confidence,
    requiresReview: true,
  };
}

export function applyConfidenceReview<T extends { confidence: number; requiresReview: boolean }>(output: T): T {
  return {
    ...output,
    requiresReview: output.requiresReview || isLowConfidence(output.confidence),
  };
}
