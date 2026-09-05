import type { AIService } from '../integrations/ai';
import type { AppLogger } from '../utils/logger';
import { anomalyExplanationModelSchema } from './anomaly.schemas';
import type { AnomalyExplanationStatus, DetectionVerdict } from './anomaly.types';
import { ANOMALY_EXPLAIN_PROMPT } from './prompts/explain';

export interface ExplainAnomalyInput {
  metric: string;
  verdict: DetectionVerdict;
  ai?: AIService | null;
  explain: boolean;
  logger?: AppLogger;
}

export interface ExplainAnomalyResult {
  explanation: string;
  recommendedAction: string;
  explanationStatus: AnomalyExplanationStatus;
}

export function fallbackExplanation(metric: string, verdict: DetectionVerdict): ExplainAnomalyResult {
  if (verdict.evidence.insufficientData && !verdict.anomaly) {
    return {
      explanation: `Not enough observations to run the requested detectors on ${metric}. No anomaly is reported, and statistical significance is not claimed.`,
      recommendedAction: 'Collect more data points, then re-run detection.',
      explanationStatus: 'skipped',
    };
  }

  if (!verdict.anomaly) {
    return {
      explanation: `No detector crossed its configured threshold for ${metric}.`,
      recommendedAction: 'No action required.',
      explanationStatus: 'skipped',
    };
  }

  const change = verdict.change === null ? 'an unspecified amount' : `${verdict.change}%`;
  const fired = verdict.evidence.fired.join(', ') || 'configured rules';
  return {
    explanation: `${metric} changed ${change} (severity ${verdict.severity}). Fired detectors: ${fired}. This is a descriptive statistical flag, not a test of statistical significance.`,
    recommendedAction: 'Review the source data and recent operational changes for this metric.',
    explanationStatus: 'skipped',
  };
}

export async function explainAnomaly(input: ExplainAnomalyInput): Promise<ExplainAnomalyResult> {
  const fallback = fallbackExplanation(input.metric, input.verdict);
  if (!input.explain || !input.verdict.anomaly) {
    return fallback;
  }

  if (!input.ai?.ready) {
    return {
      ...fallback,
      explanationStatus: 'unavailable',
    };
  }

  try {
    const prompt = ANOMALY_EXPLAIN_PROMPT.build({
      metric: input.metric,
      anomaly: input.verdict.anomaly,
      severity: input.verdict.severity,
      change: input.verdict.change,
      evidence: input.verdict.evidence,
    });
    const result = await input.ai.generateStructured({
      system: prompt.system,
      prompt: prompt.prompt,
      schema: anomalyExplanationModelSchema,
      schemaName: 'anomalyExplanation',
    });
    return {
      explanation: result.data.explanation,
      recommendedAction: result.data.recommendedAction,
      explanationStatus: 'generated',
    };
  } catch (error) {
    input.logger?.warn({ err: error, metric: input.metric }, 'Anomaly AI explanation failed');
    return {
      explanation: fallback.explanation,
      recommendedAction: 'Review the source data with a human. AI explanation is unavailable.',
      explanationStatus: 'failed',
    };
  }
}
