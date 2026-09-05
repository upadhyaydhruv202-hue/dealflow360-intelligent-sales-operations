import { collectMissingFields } from '../ai/ai.review';

export interface DocumentReviewInput {
  fields: Record<string, unknown>;
  missingFields: string[];
  confidence: number;
  warnings: string[];
  requiresReview: boolean;
}

export interface DocumentReviewOptions {
  requestedFields: string[];
  threshold: number;
}

export function applyDocumentReview(
  output: DocumentReviewInput,
  options: DocumentReviewOptions,
): DocumentReviewInput {
  const reportedMissing = output.missingFields.map((field) => field.trim()).filter(Boolean);
  const fields = nullifyReportedMissing({ ...output.fields }, reportedMissing);
  const missingFields = collectMissingFields(fields, options.requestedFields, reportedMissing);
  const nextFields = nullifyReportedMissing(fields, missingFields);
  const warnings = [...output.warnings];
  const lowConfidence = output.confidence < options.threshold;

  if (lowConfidence) {
    warnings.push(`Confidence is below the configured threshold of ${options.threshold}`);
  }

  if (missingFields.length > 0) {
    warnings.push(`Missing fields were not invented: ${missingFields.join(', ')}`);
  }

  return {
    fields: nextFields,
    missingFields,
    confidence: output.confidence,
    warnings: [...new Set(warnings)],
    requiresReview: output.requiresReview || lowConfidence || missingFields.length > 0,
  };
}

function nullifyReportedMissing(
  fields: Record<string, unknown>,
  missing: string[],
): Record<string, unknown> {
  const next = { ...fields };

  for (const field of missing) {
    next[field] = null;
  }

  return next;
}
