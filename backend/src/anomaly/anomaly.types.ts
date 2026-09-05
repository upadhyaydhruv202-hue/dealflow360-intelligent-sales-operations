import {
  JOB_NAMES,
  type AnomalyDetectorName,
  type AnomalyExplanationStatusName,
  type AnomalySeverityName,
} from '../constants';

export const ANOMALY_EVALUATE_JOB = JOB_NAMES.ANOMALY_EVALUATE;

export type AnomalySeverity = AnomalySeverityName;
export type AnomalyDetectorId = AnomalyDetectorName;
export type AnomalyExplanationStatus = AnomalyExplanationStatusName;

export interface MetricPoint {
  t?: string;
  value: number;
  count?: number;
}

export interface ThresholdDetectorConfig {
  enabled?: boolean;
  min?: number;
  max?: number;
}

export interface PercentChangeDetectorConfig {
  enabled?: boolean;
  window?: number;
  lowPct?: number;
  mediumPct?: number;
  highPct?: number;
}

export interface MovingAverageDetectorConfig {
  enabled?: boolean;
  window?: number;
  deviationPct?: number;
}

export interface FrequencyDetectorConfig {
  enabled?: boolean;
  minSamples?: number;
  expectedMin?: number;
  expectedMax?: number;
  zThreshold?: number;
}

export interface TrendDetectorConfig {
  enabled?: boolean;
  window?: number;
  minSlope?: number;
}

export interface ZScoreDetectorConfig {
  enabled?: boolean;
  minSamples?: number;
  threshold?: number;
  highThreshold?: number;
}

export interface AnomalyDetectorConfig {
  threshold?: ThresholdDetectorConfig;
  percentChange?: PercentChangeDetectorConfig;
  movingAverage?: MovingAverageDetectorConfig;
  frequency?: FrequencyDetectorConfig;
  trend?: TrendDetectorConfig;
  zScore?: ZScoreDetectorConfig;
}

export interface DetectorResult {
  name: AnomalyDetectorId;
  fired: boolean;
  skipped: boolean;
  skipReason?: string;
  severity: AnomalySeverity;
  score?: number;
  change?: number;
  details: Record<string, unknown>;
}

export interface AnomalyEvidence {
  sampleSize: number;
  latest: number;
  baseline: number | null;
  change: number | null;
  fired: AnomalyDetectorId[];
  skipped: Array<{ name: AnomalyDetectorId; reason: string }>;
  detectors: DetectorResult[];
  sufficientSample: boolean;
  claimsStatisticalSignificance: false;
  insufficientData: boolean;
}

export interface DetectionVerdict {
  anomaly: boolean;
  severity: AnomalySeverity;
  change: number | null;
  evidence: AnomalyEvidence;
}

export interface AnomalyInsight {
  id: string;
  metric: string;
  anomaly: boolean;
  severity: AnomalySeverity;
  change: number | null;
  evidence: AnomalyEvidence;
  explanation: string;
  recommendedAction: string;
  explanationStatus: AnomalyExplanationStatus;
  series?: MetricPoint[];
  metadata?: Record<string, string | number | boolean | null>;
  createdAt: string;
  createdBy?: string;
}

export interface AnomalyEvaluateInput {
  metric: string;
  points: MetricPoint[] | number[];
  detectors?: AnomalyDetectorConfig;
  explain?: boolean;
  notify?: boolean;
  async?: boolean;
  metadata?: Record<string, string | number | boolean | null>;
  userId?: string;
}

export interface AnomalyEvaluateResult extends AnomalyInsight {
  status: 'evaluated' | 'processing';
  jobId?: string;
}

export interface AnomalyStoreListQuery {
  page?: number;
  pageSize?: number;
  metric?: string;
  anomaly?: boolean;
  createdBy?: string;
}

export interface AnomalyStore {
  save(finding: AnomalyInsight): Promise<AnomalyInsight>;
  get(id: string): Promise<AnomalyInsight | null>;
  list(query: AnomalyStoreListQuery): Promise<{
    items: AnomalyInsight[];
    meta: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }>;
}
